import { HttpError } from '../handlers/httpError.js'
import { decidePushes, nextIgnoredStreak } from './decide.js'
import { sendToDevice, vapidPublicKey } from './send.js'
import { emptyDevice, getDevice, kvConfigured, listDevices, saveDevice } from './store.js'
import type { PushCommitment, PushDevice, PushSubscriptionJSON, PushWeekSnapshot } from './types.js'
import { DEFAULT_CHECK_IN_HOUR } from './types.js'

function asRecord(body: unknown) {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseSubscription(value: unknown): PushSubscriptionJSON {
  const record = asRecord(value)
  const keys = asRecord(record.keys)
  const endpoint = asString(record.endpoint)
  const p256dh = asString(keys.p256dh)
  const auth = asString(keys.auth)
  if (!endpoint || !p256dh || !auth) {
    throw new HttpError(400, 'La suscripción push no es válida.')
  }
  return { endpoint, keys: { p256dh, auth } }
}

function parseCommitments(value: unknown): PushCommitment[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = asRecord(item)
      return {
        id: asString(record.id),
        description: asString(record.description),
        dueDate: asString(record.dueDate),
        status: asString(record.status) || 'pendiente',
      }
    })
    .filter((item) => item.id && item.dueDate)
}

function parseWeek(value: unknown): PushWeekSnapshot | null {
  const record = asRecord(value)
  const weekStart = asString(record.weekStart)
  if (!weekStart) return null
  return {
    weekStart,
    activeAreas: asNumber(record.activeAreas, 0),
    totalAreas: asNumber(record.totalAreas, 0),
    hadActivity: record.hadActivity === true,
  }
}

async function requireDevice(id: string) {
  if (!id) throw new HttpError(400, 'Falta el dispositivo.')
  const device = await getDevice(id)
  if (!device) throw new HttpError(404, 'Ese dispositivo no está suscrito.')
  return device
}

export async function handlePushConfig() {
  return {
    publicKey: vapidPublicKey(),
    kv: kvConfigured(),
    configured: Boolean(vapidPublicKey()),
  }
}

export async function handlePushSubscribe(body: unknown) {
  const input = asRecord(body)
  const id = asString(input.deviceId)
  if (!id) throw new HttpError(400, 'Falta el dispositivo.')
  const existing = (await getDevice(id)) ?? emptyDevice(id)
  const next: PushDevice = {
    ...existing,
    subscription: parseSubscription(input.subscription),
    enabled: input.enabled === false ? false : true,
    checkInHour: Math.min(22, Math.max(7, asNumber(input.checkInHour, existing.checkInHour || DEFAULT_CHECK_IN_HOUR))),
    timezoneOffsetMinutes: asNumber(input.timezoneOffsetMinutes, existing.timezoneOffsetMinutes),
  }
  await saveDevice(next)
  return { ok: true, deviceId: id }
}

export async function handlePushSync(body: unknown) {
  const input = asRecord(body)
  const device = await requireDevice(asString(input.deviceId))
  const next: PushDevice = {
    ...device,
    timezoneOffsetMinutes: asNumber(input.timezoneOffsetMinutes, device.timezoneOffsetMinutes),
    checkInHour: input.checkInHour === undefined
      ? device.checkInHour
      : Math.min(22, Math.max(7, asNumber(input.checkInHour, device.checkInHour))),
    commitments: parseCommitments(input.commitments),
    week: parseWeek(input.week) ?? device.week,
  }
  await saveDevice(next)
  return { ok: true }
}

export async function handlePushInbox(deviceId: string) {
  const device = await requireDevice(deviceId)
  const inbox = device.inbox ?? []
  if (inbox.length) await saveDevice({ ...device, inbox: [] })
  return { messages: inbox }
}

export async function handlePushOpened(body: unknown) {
  const device = await requireDevice(asString(asRecord(body).deviceId))
  await saveDevice({
    ...device,
    lastOpenedAt: new Date().toISOString(),
    ignoredStreak: 0,
  })
  return { ok: true }
}

export async function handlePushSettings(body: unknown) {
  const input = asRecord(body)
  const device = await requireDevice(asString(input.deviceId))
  const enabled = input.enabled === undefined ? device.enabled : input.enabled !== false
  const next: PushDevice = {
    ...device,
    enabled,
    checkInHour: input.checkInHour === undefined
      ? device.checkInHour
      : Math.min(22, Math.max(7, asNumber(input.checkInHour, device.checkInHour))),
  }
  await saveDevice(next)
  return { ok: true, enabled: next.enabled, checkInHour: next.checkInHour }
}

function cronAuthorized(header: string | undefined, querySecret: string) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.VERCEL !== '1'
  return header === `Bearer ${secret}` || querySecret === secret
}

export async function handleCronPush(input: {
  authorization?: string
  secret?: string
  at?: string
}) {
  if (!cronAuthorized(input.authorization, input.secret || '')) {
    throw new HttpError(401, 'Cron no autorizado.')
  }

  const now = input.at ? new Date(input.at) : new Date()
  if (Number.isNaN(now.getTime())) throw new HttpError(400, 'La fecha simulada no es válida.')

  const devices = await listDevices()
  const results: Array<{ deviceId: string; sent: number; tags: string[] }> = []

  for (const device of devices) {
    if (!device.enabled || !device.subscription) continue

    const previousIgnored = Boolean(
      device.lastPushAt && (!device.lastOpenedAt || Date.parse(device.lastOpenedAt) < Date.parse(device.lastPushAt)),
    )
    const working: PushDevice = {
      ...device,
      ignoredStreak: previousIgnored ? nextIgnoredStreak(device) : device.lastPushAt ? 0 : device.ignoredStreak,
    }

    const messages = decidePushes(working, now)
    if (!messages.length) continue

    const sent = await sendToDevice(working, messages)
    if (sent.gone) continue

    const notified = { ...working.notified }
    for (const message of messages) notified[message.tag] = now.toISOString()
    const weekly = messages.find((item) => item.kind === 'weekly')

    await saveDevice({
      ...working,
      notified,
      inbox: messages,
      lastPushAt: now.toISOString(),
      lastWeeklyWeek: weekly ? weekly.tag.replace('weekly:', '') : working.lastWeeklyWeek,
    })

    results.push({ deviceId: working.id, sent: sent.sent, tags: messages.map((item) => item.tag) })
  }

  return { ok: true, at: now.toISOString(), results }
}
