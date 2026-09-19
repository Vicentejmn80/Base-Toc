/** Parse aliases only — not country or institution assumptions. */
const ALIASES: Record<string, string> = {
  usd: 'USD',
  dolar: 'USD',
  dolares: 'USD',
  dólares: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  gbp: 'GBP',
  libra: 'GBP',
  libras: 'GBP',
  pound: 'GBP',
  pounds: 'GBP',
  ves: 'VES',
  bolivar: 'VES',
  bolívares: 'VES',
  bolivares: 'VES',
  usdt: 'USDT',
  jpy: 'JPY',
  yen: 'JPY',
  yenes: 'JPY',
  cad: 'CAD',
  aud: 'AUD',
  brl: 'BRL',
  reales: 'BRL',
  mxn: 'MXN',
  pesos: 'MXN',
  pen: 'PEN',
  soles: 'PEN',
  cop: 'COP',
  ars: 'ARS',
  clp: 'CLP',
  btc: 'BTC',
  bitcoin: 'BTC',
  eth: 'ETH',
}

const WORD_STOP = new Set([
  'pagaron', 'pagado', 'pague', 'cobre', 'cobraron', 'pase', 'cambie', 'compre', 'vendi',
  'recibi', 'hoy', 'ayer', 'por', 'con', 'de', 'en', 'los', 'las', 'una', 'uno', 'unos',
  'despues', 'luego', 'desde', 'hacia', 'para', 'como', 'este', 'esta', 'mi', 'su',
])

export function normalizeCurrencyCode(raw?: string) {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const compact = trimmed.replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]/g, '').toLowerCase()
  if (ALIASES[compact]) return ALIASES[compact]
  const upper = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (upper.length >= 2 && upper.length <= 8) return upper
  return undefined
}

export function parseCurrencyToken(raw?: string) {
  if (!raw) return undefined
  if (raw === '$') return 'USD'
  if (raw === '€') return 'EUR'
  if (raw === '£') return 'GBP'
  const trimmed = raw.trim()
  const compact = trimmed.replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]/g, '').toLowerCase()
  if (!compact || WORD_STOP.has(compact)) return undefined
  if (ALIASES[compact]) return ALIASES[compact]
  if (/^[A-Z]{3,5}$/.test(trimmed)) return trimmed
  return undefined
}

export function formatMoney(amount: number, currency: string, locale?: string) {
  const number = Math.abs(amount).toLocaleString(locale, { maximumFractionDigits: 2 })
  const sign = amount < 0 ? '−' : ''
  return `${sign}${number} ${currency}`
}

export function formatSignedMoney(amount: number, currency: string, locale?: string) {
  const abs = formatMoney(Math.abs(amount), currency, locale)
  if (amount > 0) return `+${abs}`
  if (amount < 0) return `−${abs.replace(/^-/, '')}`
  return abs
}

export function impliedRate(fromAmount: number, toAmount: number) {
  if (!fromAmount) return undefined
  return toAmount / fromAmount
}

export function rateQuote(fromAmount: number, fromCurrency: string, toAmount: number, toCurrency: string) {
  const rate = impliedRate(fromAmount, toAmount)
  if (rate === undefined) return undefined
  const rounded = Number(rate.toFixed(6))
  return { rate: rounded, quote: `${rounded} ${toCurrency} / ${fromCurrency}` }
}
