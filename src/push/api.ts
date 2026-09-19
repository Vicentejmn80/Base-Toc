import type { Commitment, Workspace } from '../domain/types'
import { recordDateValue } from '../lib/schema'
import { weekStartIso } from './events'
import { loadPushPrefs } from './prefs'

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error || 'No se pudo hablar con el servidor de avisos.')
  }
  return response.json()
}

export async function fetchPushConfig() {
  const response = await fetch('/api/push/config')
  if (!response.ok) return { publicKey: null as string | null, configured: false }
  return (await response.json()) as { publicKey: string | null; configured: boolean }
}

export function weekSnapshot(workspaces: Workspace[]) {
  const weekStart = weekStartIso()
  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let activeAreas = 0
  for (const workspace of workspaces) {
    const hit = workspace.records.some((record) => {
      const date = String(recordDateValue(workspace, record)).slice(0, 10)
      return date >= weekStart && date <= todayLocal
    })
    if (hit) activeAreas += 1
  }
  return {
    weekStart,
    activeAreas,
    totalAreas: workspaces.length,
    hadActivity: activeAreas > 0,
  }
}

export function syncPayload(commitments: Commitment[], workspaces: Workspace[]) {
  const prefs = loadPushPrefs()
  return {
    deviceId: prefs.deviceId,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    checkInHour: prefs.checkInHour,
    commitments: commitments.map((item) => ({
      id: item.id,
      description: item.description,
      dueDate: item.dueDate,
      status: item.status,
    })),
    week: weekSnapshot(workspaces),
  }
}

export function syncPushState(commitments: Commitment[], workspaces: Workspace[]) {
  const prefs = loadPushPrefs()
  if (!prefs.subscribed) return Promise.resolve()
  return postJson('/api/push/sync', syncPayload(commitments, workspaces)).catch(() => undefined)
}

export function markPushOpened() {
  const prefs = loadPushPrefs()
  if (!prefs.subscribed) return Promise.resolve()
  return postJson('/api/push/opened', { deviceId: prefs.deviceId }).catch(() => undefined)
}

export function savePushServerSettings(patch: { enabled?: boolean; checkInHour?: number }) {
  const prefs = loadPushPrefs()
  if (!prefs.subscribed) return Promise.resolve()
  return postJson('/api/push/settings', { deviceId: prefs.deviceId, ...patch })
}

export async function pullPushInbox() {
  const prefs = loadPushPrefs()
  if (!prefs.subscribed) return [] as Array<{ title: string; body: string; url?: string }>
  const response = await fetch(`/api/push/inbox?deviceId=${encodeURIComponent(prefs.deviceId)}`)
  if (!response.ok) return []
  const payload = (await response.json()) as { messages?: Array<{ title: string; body: string; url?: string }> }
  return payload.messages ?? []
}

export async function registerPushSubscription(checkInHour: number) {
  const config = await fetchPushConfig()
  const prefs = loadPushPrefs()
  try {
    if (!config.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('push-local')
    }
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      }))
    await postJson('/api/push/subscribe', {
      deviceId: prefs.deviceId,
      subscription: subscription.toJSON(),
      checkInHour,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      enabled: true,
    })
  } catch {
    await postJson('/api/push/subscribe', {
      deviceId: prefs.deviceId,
      subscription: {
        endpoint: `local:${prefs.deviceId}`,
        keys: { p256dh: 'local', auth: 'local' },
      },
      checkInHour,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      enabled: true,
    })
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

export async function disableBrowserSubscription() {
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const subscription = await registration?.pushManager.getSubscription()
  await subscription?.unsubscribe()
}
