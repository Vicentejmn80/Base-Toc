import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CHECK_IN_HOUR, PUSH_STORE_KEY, type PushDevice } from './types.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const filePath = path.join(root, '.data', 'push-store.json')

type DeviceMap = Record<string, PushDevice>

function kvEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/$/, ''), token }
}

async function kvCommand(command: unknown[]) {
  const env = kvEnv()
  if (!env) return null
  const response = await fetch(env.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`KV ${response.status}: ${text.slice(0, 200)}`)
  }
  return (await response.json()) as { result?: unknown }
}

async function readFileStore(): Promise<DeviceMap> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as DeviceMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writeFileStore(devices: DeviceMap) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(devices, null, 2), 'utf8')
}

async function readAll(): Promise<DeviceMap> {
  if (kvEnv()) {
    const result = await kvCommand(['GET', PUSH_STORE_KEY])
    const raw = result?.result
    if (typeof raw !== 'string' || !raw) return {}
    try {
      const parsed = JSON.parse(raw) as DeviceMap
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return readFileStore()
}

async function writeAll(devices: DeviceMap) {
  if (kvEnv()) {
    await kvCommand(['SET', PUSH_STORE_KEY, JSON.stringify(devices)])
    return
  }
  await writeFileStore(devices)
}

export function emptyDevice(id: string, partial: Partial<PushDevice> = {}): PushDevice {
  return {
    id,
    subscription: null,
    enabled: true,
    checkInHour: DEFAULT_CHECK_IN_HOUR,
    timezoneOffsetMinutes: 240,
    ignoredStreak: 0,
    notified: {},
    commitments: [],
    week: null,
    inbox: [],
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

export async function listDevices() {
  const devices = await readAll()
  return Object.values(devices)
}

export async function getDevice(id: string) {
  const devices = await readAll()
  return devices[id] ?? null
}

export async function saveDevice(device: PushDevice) {
  const devices = await readAll()
  devices[device.id] = { ...device, updatedAt: new Date().toISOString() }
  await writeAll(devices)
  return devices[device.id]
}

export async function deleteDevice(id: string) {
  const devices = await readAll()
  delete devices[id]
  await writeAll(devices)
}

export function kvConfigured() {
  return Boolean(kvEnv())
}
