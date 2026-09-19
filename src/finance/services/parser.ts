import { normalizeCurrencyCode, parseCurrencyToken } from '../domain/currency'
import type { FinanceBook, FinanceBrainResult, FinancialEventType, ParsedFinanceEvent } from '../domain/types'

const DATE_WORDS: Record<string, number> = {
  hoy: 0,
  today: 0,
  ayer: -1,
  yesterday: -1,
  anteayer: -2,
}

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/\b(trabajo|freelance|cliente|proyecto)\b/i, 'freelance'],
  [/\b(sueldo|salario|nómina|nomina|salary)\b/i, 'salary'],
  [/\b(negocio|venta|business)\b/i, 'business'],
  [/\b(comida|almuerzo|cena|restaurante|food|grocer)/i, 'food'],
  [/\b(transporte|taxi|uber|metro|gasolina|transport)/i, 'transport'],
  [/\b(alquiler|renta|casa|housing|hipoteca)/i, 'housing'],
  [/\b(suscripci[oó]n|netflix|spotify)/i, 'subscriptions'],
  [/\b(educaci[oó]n|curso|universidad)/i, 'education'],
  [/\b(salud|m[eé]dico|farmacia|health)/i, 'health'],
  [/\b(cine|ocio|entretenimiento|entertainment)/i, 'entertainment'],
  [/\b(impuesto|tax)/i, 'taxes'],
  [/\b(comisi[oó]n|fee)\b/i, 'fees'],
]

function isoFromRelative(word?: string) {
  if (!word) return undefined
  const offset = DATE_WORDS[word.toLowerCase()]
  if (offset === undefined) return undefined
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString()
}

function parseNumberToken(raw: string) {
  const cleaned = raw.replace(/[^\d.,]/g, '')
  if (!cleaned) return undefined
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    return Number(cleaned.split(thousandSep).join('').replace(decimalSep, '.'))
  }
  if (/^\d{1,3}([.]\d{3})+$/.test(cleaned) || /^\d{1,3}([,]\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/[.,]/g, ''))
  }
  if (cleaned.includes(',')) return Number(cleaned.replace(',', '.'))
  return Number(cleaned)
}

interface AmountHit {
  amount: number
  currency?: string
  index: number
  text: string
}

function extractAmounts(text: string): AmountHit[] {
  const hits: AmountHit[] = []
  const pattern = /(?<sym>\$|€|£)?\s*(?<num>\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*(?<curPost>[A-Za-zÁÉÍÓÚáéíóú]{3,12}))?/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const amount = parseNumberToken(match.groups?.num ?? '')
    if (amount === undefined || Number.isNaN(amount)) continue
    const currency = parseCurrencyToken(match.groups?.sym) ?? parseCurrencyToken(match.groups?.curPost)
    hits.push({ amount, currency, index: match.index, text: match[0] })
  }
  return hits
}

function hasVerb(text: string, pattern: RegExp) {
  return pattern.test(text.toLowerCase())
}

function detectType(text: string): FinancialEventType | undefined {
  const value = text.toLowerCase()
  if (hasVerb(value, /devolvieron|devoluci[oó]n|reembolso|refund/)) return 'refund'
  if (hasVerb(value, /comisi[oó]n|fee/) && hasVerb(value, /cobraron|cobr[oó]|pagu[eé]|descuento/)) return 'fee'
  if (hasVerb(value, /cambi[eé]|convirt|vend[ií]|exchange/) && hasVerb(value, /por|recib|a cambio/)) return 'exchange'
  if (hasVerb(value, /pas[eé]|transfer|envi[eé]|mov[ií]/) && hasVerb(value, /\b(de|a|hacia)\b/)) return 'transfer'
  if (hasVerb(value, /compr[eé]|gast[eé]|pagu[eé]|pagamos/)) return 'expense'
  if (hasVerb(value, /cobr[eé]|pagaron|ingres|recib[ií]|salario|sueldo/)) return 'income'
  if (hasVerb(value, /ajust[eé]|correg/)) return 'adjustment'
  if (hasVerb(value, /comisi[oó]n/)) return 'fee'
  if (hasVerb(value, /vend[ií]/)) return 'exchange'
  return undefined
}

function detectCategory(text: string) {
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category
  }
  return undefined
}

function detectDate(text: string) {
  const match = text.match(/\b(hoy|ayer|anteayer|today|yesterday)\b/i)
  return isoFromRelative(match?.[1])
}

function knownAccountHints(book: FinanceBook) {
  return book.accounts.filter((account) => account.active).map((account) => account.name)
}

function extractAccountHints(text: string, book: FinanceBook) {
  const hints: { role: 'source' | 'destination' | 'either'; name: string }[] = []
  const known = knownAccountHints(book)
  const add = (role: 'source' | 'destination' | 'either', raw?: string) => {
    const name = raw
      ?.trim()
      .replace(/[.,;]+$/, '')
      .replace(/\b(un|una)\s+/i, '')
      .trim()
    if (!name || name.length < 2) return
    if (/^\d/.test(name)) return
    if (parseCurrencyToken(name)) return
    if (/^(el|la|mi|su|trabajo|comida|comision|comisión|compra|moneda|local)$/i.test(name)) return
    if (/moneda/.test(name.toLowerCase())) return
    if (detectCategory(name)) return
    hints.push({ role, name })
  }

  const from = text.match(/\b(?:de|desde)\s+(?:mi\s+)?([^,.;]+?)(?=\s+(?:a|hacia|por|y|luego|despu[eé]s)\b|[.,;]|$)/i)
  add('source', from?.[1])
  const to = text.match(/\b(?:a|hacia)\s+(?:mi\s+)?([^,.;]+?)(?=\s+(?:y|luego|despu[eé]s|por)\b|[.,;]|$)/i)
  add('destination', to?.[1])

  const viaPattern = /\b(?:por|con|en)\s+(?:mi\s+)?([A-Za-zÁÉÍÓÚáéíóú][A-Za-zÁÉÍÓÚáéíóú0-9 ]{1,40})/gi
  let via: RegExpExecArray | null
  while ((via = viaPattern.exec(text))) {
    const fragment = via[1].split(/\s+(?:con|y|luego|despu[eé]s)\b/i)[0]
    add('either', fragment)
  }

  for (const name of known) {
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(text) && !hints.some((hint) => hint.name.toLowerCase() === name.toLowerCase())) {
      hints.push({ role: 'either', name })
    }
  }
  return hints
}

function splitClauses(text: string) {
  return text
    .split(/\s*(?:,\s*)?(?:despu[eé]s|luego|y luego|y despu[eé]s|then)\s+/i)
    .map((part) => part.replace(/^[,.\s]+|[,.\s]+$/g, ''))
    .filter(Boolean)
}

function looksLikeCurrencyGap(text: string) {
  return /\b(moneda local|moneda que tengo|esa moneda|mi moneda)\b/i.test(text)
}

function parseClause(text: string, book: FinanceBook): ParsedFinanceEvent {
  const amounts = extractAmounts(text)
  const type = detectType(text)
  const category = detectCategory(text)
  const date = detectDate(text)
  const accounts = extractAccountHints(text, book)
  const sourceHint = accounts.find((item) => item.role === 'source')?.name ?? accounts.find((item) => item.role === 'either')?.name
  const destinationHint = accounts.find((item) => item.role === 'destination')?.name
  const feeMatch = text.match(/comisi[oó]n(?:\s+de)?\s*(\d[\d.,]*)\s*([A-Za-zÁÉÍÓÚáéíóú]{3,12})?/i)
  const feeFromBecause = text.match(/porque\s+me\s+cobraron\s+(\d[\d.,]*)\s*([A-Za-zÁÉÍÓÚáéíóú]{3,12})?/i)

  const first = amounts[0]
  const second = amounts[1]
  const currencyMention = text.match(/\b(d[oó]lares?|euros?|libras?|bol[ií]vares?|usdt|usd|eur|ves|gbp)\b/i)
  const parsed: ParsedFinanceEvent = {
    type: type ?? 'other',
    amount: first?.amount,
    currency: first?.currency ?? parseCurrencyToken(currencyMention?.[1]),
    accountHint: sourceHint,
    destinationAmount: second?.amount,
    destinationCurrency: second?.currency,
    destinationAccountHint: destinationHint,
    category,
    description: text.trim(),
    date,
  }

  if (feeMatch || feeFromBecause) {
    const fee = feeMatch ?? feeFromBecause
    parsed.feeAmount = parseNumberToken(fee?.[1] ?? '')
    parsed.feeCurrency = normalizeCurrencyCode(fee?.[2]) ?? second?.currency ?? first?.currency
  }

  if (looksLikeCurrencyGap(text)) {
    if (!parsed.currency) parsed.currency = undefined
    if (/\bmoneda local\b/i.test(text)) parsed.destinationCurrency = undefined
    if (/\bmoneda que tengo\b/i.test(text) && first && !first.currency) parsed.currency = undefined
  }

  return parsed
}

function isMoneyUtterance(text: string) {
  return (
    extractAmounts(text).length > 0 ||
    /\b(cobr|pag|compr|gast|pas[eé]|cambi|vend|devolv|comisi|transfer|ingres|d[oó]lar|euro|usdt|libra)\w*\b/i.test(text)
  )
}

export function parseFinanceUtterance(text: string, book: FinanceBook): FinanceBrainResult {
  const source = text.trim()
  if (!source || !isMoneyUtterance(source)) return { kind: 'unparsed', source }

  const clauses = splitClauses(source)
  const events = clauses.map((clause) => parseClause(clause, book))

  if (events.length === 2 && events[0].type === 'income' && events[1].type === 'other' && events[1].amount) {
    events[1].type = events[1].destinationAmount && events[1].destinationCurrency && events[1].destinationCurrency !== events[1].currency ? 'exchange' : 'transfer'
    if (events[1].type === 'transfer') {
      events[1].accountHint = events[1].accountHint ?? events[0].accountHint
      events[1].currency = events[1].currency ?? events[0].currency
    }
  }

  return { kind: 'events', events, source }
}

export function looksLikeFinanceUtterance(text: string) {
  return isMoneyUtterance(text)
}
