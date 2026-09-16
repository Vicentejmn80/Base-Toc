import { useEffect, useState } from 'react'

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone) return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

const NARROW_QUERY = '(max-width: 1023px)'

export function isMobileExperience() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(NARROW_QUERY).matches || isStandaloneDisplay()
}

export function useAppExperience() {
  const [experience, setExperience] = useState<'mobile' | 'desktop'>(() =>
    isMobileExperience() ? 'mobile' : 'desktop',
  )

  useEffect(() => {
    const narrow = window.matchMedia(NARROW_QUERY)
    const standalone = window.matchMedia('(display-mode: standalone)')
    const update = () => setExperience(isMobileExperience() ? 'mobile' : 'desktop')
    narrow.addEventListener('change', update)
    standalone.addEventListener('change', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      narrow.removeEventListener('change', update)
      standalone.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return experience
}
