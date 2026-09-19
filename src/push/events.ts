export type ValueMoment = 'commitment'

export function emitValueMoment(kind: ValueMoment) {
  if (typeof window === 'undefined') return
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent('nexora:value-moment', { detail: { kind } }))
  })
}

export function weekStartIso(now = new Date()) {
  const date = new Date(now)
  date.setHours(12, 0, 0, 0)
  const diff = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - diff)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
