export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('es-PE', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

const MONEY_UNITS: Record<string, string> = {
  's/': 'S/',
  's/.': 'S/',
  pen: 'S/',
  soles: 'S/',
  $: '$',
  usd: '$',
  dolar: '$',
  dolares: '$',
  dólares: '$',
  eur: '€',
  euro: '€',
  euros: '€',
  '€': '€',
}

export function formatAmount(value: number, unit?: string) {
  const raw = (unit ?? '').trim()
  if (!raw) return formatNumber(value, Number.isInteger(value) ? 0 : 1)

  const mapped = MONEY_UNITS[raw.toLowerCase()] ?? MONEY_UNITS[raw]
  if (mapped) {
    const digits = Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 2
    return `${mapped} ${formatNumber(value, digits)}`
  }

  if (raw === '%') return formatPercent(value)
  const digits = /km/i.test(raw) ? 1 : Number.isInteger(value) ? 0 : 1
  return `${formatNumber(value, digits)} ${raw}`
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 0)}%`
}

export function formatPace(minutesPerKm: number) {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) return '—'
  const minutes = Math.floor(minutesPerKm)
  const seconds = Math.round((minutesPerKm - minutes) * 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

export function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest} min`
  return `${hours}h ${rest}m`
}
