import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { useAppStore } from '../state/store'
import {
  disableBrowserSubscription,
  markPushOpened,
  pullPushInbox,
  registerPushSubscription,
  savePushServerSettings,
  syncPushState,
} from './api'
import { loadPushPrefs, pushSupported, savePushPrefs, type PushPrefs } from './prefs'

interface IncomingPush {
  title: string
  body: string
  url?: string
}

interface PushContextValue {
  prefs: PushPrefs
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  enable: () => Promise<void>
  disable: () => Promise<void>
  setCheckInHour: (hour: number) => Promise<void>
}

const PushContext = createContext<PushContextValue | null>(null)

export function PushProvider({ children }: { children: ReactNode }) {
  const { hydrated, commitments, workspaces } = useAppStore()
  const supported = pushSupported()
  const [prefs, setPrefs] = useState<PushPrefs>(() => (typeof window === 'undefined' ? {
    deviceId: 'push_ssr',
    prompt: 'idle',
    enabled: true,
    checkInHour: 20,
    subscribed: false,
  } : loadPushPrefs()))
  const [ask, setAsk] = useState(false)
  const [incoming, setIncoming] = useState<IncomingPush | null>(null)
  const seenHydrate = useRef(false)
  const commitmentCount = useRef(0)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported',
  )

  const writePrefs = useCallback((next: PushPrefs) => {
    savePushPrefs(next)
    setPrefs(next)
  }, [])

  const enable = useCallback(async () => {
    if (!('Notification' in window)) {
      writePrefs({ ...loadPushPrefs(), prompt: 'denied', subscribed: false, enabled: false })
      setAsk(false)
      return
    }
    const result =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') {
      writePrefs({ ...loadPushPrefs(), prompt: 'denied', subscribed: false, enabled: false })
      setAsk(false)
      return
    }
    try {
      await registerPushSubscription(loadPushPrefs().checkInHour)
      writePrefs({ ...loadPushPrefs(), prompt: 'asked', subscribed: true, enabled: true })
      setAsk(false)
      void syncPushState(commitments, workspaces)
    } catch (error) {
      console.error('[push] subscribe', error)
      setAsk(false)
    }
  }, [commitments, workspaces, writePrefs])

  const disable = useCallback(async () => {
    await disableBrowserSubscription().catch(() => undefined)
    await savePushServerSettings({ enabled: false }).catch(() => undefined)
    writePrefs({ ...loadPushPrefs(), enabled: false })
  }, [writePrefs])

  const setCheckInHour = useCallback(async (hour: number) => {
    const next = { ...loadPushPrefs(), checkInHour: hour }
    writePrefs(next)
    if (next.subscribed) await savePushServerSettings({ checkInHour: hour }).catch(() => undefined)
  }, [writePrefs])

  useEffect(() => {
    if (!hydrated || !prefs.subscribed || !prefs.enabled) return
    void syncPushState(commitments, workspaces)
  }, [hydrated, commitments, workspaces, prefs.subscribed, prefs.enabled])

  useEffect(() => {
    if (!hydrated) return
    if (!seenHydrate.current) {
      seenHydrate.current = true
      commitmentCount.current = commitments.length
      return
    }
    if (commitments.length > commitmentCount.current && loadPushPrefs().prompt === 'idle') {
      setAsk(true)
    }
    commitmentCount.current = commitments.length
  }, [hydrated, commitments.length])

  useEffect(() => {
    const onValue = () => {
      if (loadPushPrefs().prompt !== 'idle') return
      setAsk(true)
    }
    window.addEventListener('nexora:value-moment', onValue)
    return () => window.removeEventListener('nexora:value-moment', onValue)
  }, [])

  useEffect(() => {
    if (!supported) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; title?: string; body?: string; url?: string } | undefined
      if (data?.type === 'push-opened') {
        void markPushOpened()
        return
      }
      if (data?.type !== 'push') return
      setIncoming({ title: data.title || 'Aviso', body: data.body || '', url: data.url })
      void markPushOpened()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [supported])

  useEffect(() => {
    if (!prefs.subscribed || !prefs.enabled) return
    let cancelled = false
    const tick = async () => {
      const messages = await pullPushInbox().catch(() => [])
      if (cancelled || !messages.length) return
      const last = messages[messages.length - 1]
      setIncoming({ title: last.title, body: last.body, url: last.url })
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [prefs.subscribed, prefs.enabled])

  const value = useMemo<PushContextValue>(
    () => ({
      prefs,
      supported,
      permission,
      enable,
      disable,
      setCheckInHour,
    }),
    [prefs, supported, permission, enable, disable, setCheckInHour],
  )

  return (
    <PushContext.Provider value={value}>
      {children}
      {ask ? (
        <div className="fixed inset-x-0 bottom-0 z-[80] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-6">
          <div
            data-testid="push-permission-prompt"
            className="mx-auto max-w-md rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-float)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Avisos</p>
            <p className="mt-2 text-[15px] leading-6 text-ink">
              Te aviso cuando tengas un compromiso pendiente y te mando un resumen los domingos. Nada más.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                data-testid="push-permission-later"
                onClick={() => {
                  writePrefs({ ...loadPushPrefs(), prompt: 'later' })
                  setAsk(false)
                }}
              >
                Ahora no
              </Button>
              <Button data-testid="push-permission-allow" onClick={() => void enable()}>
                Avisarme
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {incoming ? (
        <button
          type="button"
          data-testid="push-banner"
          className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] rounded-2xl bg-ink px-4 py-3 text-left text-white shadow-[var(--shadow-float)]"
          onClick={() => {
            void markPushOpened()
            setIncoming(null)
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Notificación</p>
          <p className="mt-1 text-sm font-medium">{incoming.title}</p>
          <p className="mt-0.5 text-sm text-white/80">{incoming.body}</p>
        </button>
      ) : null}
    </PushContext.Provider>
  )
}

export function usePush() {
  const value = useContext(PushContext)
  if (!value) throw new Error('usePush must be used within PushProvider')
  return value
}
