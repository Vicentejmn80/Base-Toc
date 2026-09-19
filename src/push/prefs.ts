const PREFS_KEY = 'nexora.push.prefs.v1'

export type PushPromptState = 'idle' | 'later' | 'denied' | 'asked'

export interface PushPrefs {
  deviceId: string
  prompt: PushPromptState
  enabled: boolean
  checkInHour: number
  subscribed: boolean
}

function createDeviceId() {
  return `push_${crypto.randomUUID()}`
}

export function defaultPushPrefs(): PushPrefs {
  return {
    deviceId: createDeviceId(),
    prompt: 'idle',
    enabled: true,
    checkInHour: 20,
    subscribed: false,
  }
}

export function loadPushPrefs(): PushPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) {
      const next = defaultPushPrefs()
      savePushPrefs(next)
      return next
    }
    const parsed = JSON.parse(raw) as Partial<PushPrefs>
    return {
      ...defaultPushPrefs(),
      ...parsed,
      deviceId: parsed.deviceId || createDeviceId(),
    }
  } catch {
    const next = defaultPushPrefs()
    savePushPrefs(next)
    return next
  }
}

export function savePushPrefs(prefs: PushPrefs) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}
