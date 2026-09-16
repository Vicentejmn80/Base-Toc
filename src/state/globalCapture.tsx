import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { GlobalCaptureSheet } from '../components/capture/GlobalCaptureSheet'

interface GlobalCaptureContextValue {
  open: boolean
  openCapture: (message?: string) => void
  closeCapture: () => void
}

const GlobalCaptureContext = createContext<GlobalCaptureContextValue | null>(null)

export function GlobalCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState<string | undefined>()

  const openCapture = useCallback((message?: string) => {
    setSeed(message?.trim() || undefined)
    setOpen(true)
  }, [])

  const closeCapture = useCallback(() => {
    setOpen(false)
    setSeed(undefined)
  }, [])

  return (
    <GlobalCaptureContext.Provider value={{ open, openCapture, closeCapture }}>
      {children}
      <GlobalCaptureSheet open={open} seed={seed} onClose={closeCapture} />
    </GlobalCaptureContext.Provider>
  )
}

export function useGlobalCapture() {
  const value = useContext(GlobalCaptureContext)
  if (!value) throw new Error('useGlobalCapture must be used within GlobalCaptureProvider')
  return value
}
