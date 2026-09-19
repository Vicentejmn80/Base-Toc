import { normalizeCurrencyCode } from '../domain/currency'
import type { FinanceBook, FinanceBrainResult, ParsedFinanceEvent } from '../domain/types'
import { interpretFinance } from './interpret'
import { validateFinanceParse } from './validator'

function extractBareNumber(text: string) {
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)/)
  if (!match) return undefined
  const raw = match[1]
  if (/^\d{1,3}([.]\d{3})+$/.test(raw) || /^\d{1,3}([,]\d{3})+$/.test(raw)) {
    return Number(raw.replace(/[.,]/g, ''))
  }
  return Number(raw.replace(',', '.'))
}

export function applyFinanceClarification(
  source: string,
  answer: string,
  book: FinanceBook,
  partial?: ParsedFinanceEvent[],
): FinanceBrainResult {
  const combined = `${source}. ${answer}`.trim()
  const fresh = interpretFinance(combined, book)
  if (fresh.kind === 'events') return fresh
  if (!partial?.length) return fresh

  const next = partial.map((event) => ({ ...event }))
  const currency = normalizeCurrencyCode(answer)
  const amount = extractBareNumber(answer)
  const account = answer
    .replace(/[?¿]/g, '')
    .replace(/\b(desde|en|de|a|por|con|mi|la|el)\b/gi, '')
    .trim()

  for (const event of next) {
    if (!event.amount && amount !== undefined) event.amount = amount
    if (!event.currency && currency) event.currency = currency
    if (event.type === 'exchange' && !event.destinationCurrency && currency && event.currency && currency !== event.currency) {
      event.destinationCurrency = currency
    }
    if (event.type === 'exchange' && !event.destinationAmount && amount !== undefined && event.amount !== amount) {
      event.destinationAmount = amount
    }
    if (!event.accountHint && account.length >= 2 && !currency) event.accountHint = account
    if (event.type === 'transfer' && !event.destinationAccountHint && account.length >= 2) {
      event.destinationAccountHint = account
    }
  }

  return validateFinanceParse({ kind: 'events', events: next, source: combined }, book)
}
