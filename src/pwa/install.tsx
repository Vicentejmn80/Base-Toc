import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isMobileExperience } from '../lib/experience'

const STORAGE_KEY = 'nexora.pwa.install.v1'
const SHOW_AFTER_MS = 28_000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallContextValue {
  canInstall: boolean
  visible: boolean
  iosHint: boolean
  install: () => Promise<void>
  dismiss: () => void
}

const InstallContext = createContext<InstallContextValue | null>(null)

function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dismissed'
  } catch {
    return false
  }
}

function isIos() {
  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS && !window.matchMedia('(display-mode: standalone)').matches
}

export function InstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [readyToShow, setReadyToShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (readDismissed()) return
    const timer = window.setTimeout(() => setReadyToShow(true), SHOW_AFTER_MS)
    setIosHint(isIos())
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setVisible(false)
      try {
        window.localStorage.setItem(STORAGE_KEY, 'dismissed')
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!readyToShow || readDismissed()) return
    if (!isMobileExperience()) return
    if (deferred || isIos()) setVisible(true)
  }, [readyToShow, deferred])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, 'dismissed')
    } catch {
      /* ignore */
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    if (choice.outcome !== 'accepted') dismiss()
  }, [deferred, dismiss])

  const value = useMemo<InstallContextValue>(
    () => ({
      canInstall: Boolean(deferred),
      visible,
      iosHint,
      install,
      dismiss,
    }),
    [deferred, visible, iosHint, install, dismiss],
  )

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>
}

export function useInstallPrompt() {
  const value = useContext(InstallContext)
  if (!value) throw new Error('useInstallPrompt must be used within InstallProvider')
  return value
}
