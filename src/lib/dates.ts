export function toIsoDate(value = new Date()) {
  return value.toISOString().slice(0, 10)
}

export function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: unknown, fallback = '—') {
  const date = parseDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: unknown, fallback = '—') {
  const date = parseDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export function isWithinDays(value: unknown, days: number) {
  const date = parseDate(value)
  if (!date) return false
  const now = startOfDay(new Date())
  const limit = daysFromNow(days)
  return date >= now && date <= limit
}

export function isInPast(value: unknown) {
  const date = parseDate(value)
  if (!date) return false
  return startOfDay(date) < startOfDay(new Date())
}

export function greetingForNow(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export type PeriodKey = '7d' | '30d' | '90d' | 'all'

export function isWithinPeriod(value: unknown, period: PeriodKey) {
  if (period === 'all') return true
  const date = parseDate(value)
  if (!date) return false
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const from = daysFromNow(-days)
  return date >= from
}
