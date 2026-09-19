import { findAccount } from '../domain/book'
import { impliedRate, rateQuote } from '../domain/currency'
import type { FinanceBook, FinanceBrainResult, ParsedFinanceEvent } from '../domain/types'

function uniqueCurrencies(book: FinanceBook) {
  const values = new Set<string>()
  if (book.setup.displayCurrency) values.add(book.setup.displayCurrency)
  for (const currency of book.setup.extraCurrencies) values.add(currency)
  for (const account of book.accounts) if (account.currency) values.add(account.currency)
  for (const event of book.events) values.add(event.currency)
  return [...values]
}

function uniqueAccounts(book: FinanceBook) {
  return book.accounts.filter((account) => account.active)
}

function inheritAcrossEvents(events: ParsedFinanceEvent[]) {
  const first = events[0]
  if (!first) return events
  return events.map((event, index) => {
    if (index === 0) return event
    return {
      ...event,
      currency: event.currency ?? first.currency,
      accountHint: event.accountHint ?? (event.type === 'transfer' || event.type === 'exchange' ? first.accountHint : event.accountHint),
    }
  })
}

export function validateFinanceParse(result: FinanceBrainResult, book: FinanceBook): FinanceBrainResult {
  if (result.kind !== 'events') return result
  const questions: string[] = []
  const events = inheritAcrossEvents(result.events.map((event) => enrichEvent(event, book)))

  for (const event of events) {
    if (event.type === 'other' && event.amount === undefined) {
      return { kind: 'unparsed', source: result.source }
    }
    if (event.amount === undefined) {
      questions.push(questionForMissingAmount(event))
      continue
    }
    if (!event.currency) {
      const currencies = uniqueCurrencies(book)
      questions.push(
        currencies.length > 1
          ? `¿${event.amount} ${currencies.slice(0, 3).join(', ')} u otra moneda?`
          : `¿${event.amount} de qué moneda?`,
      )
      continue
    }
    if ((event.type === 'transfer' || event.type === 'exchange') && !event.accountHint && uniqueAccounts(book).length > 1) {
      const names = uniqueAccounts(book)
        .map((account) => account.name)
        .slice(0, 3)
        .join(' o ')
      questions.push(`¿Lo moviste desde ${names} u otra cuenta?`)
    }
    const mentionsReceive = /recib|a cambio|por\s+\d/i.test(result.source)
    if (event.type === 'exchange' && (mentionsReceive || event.destinationAmount || event.destinationCurrency)) {
      if (!event.destinationAmount) questions.push('¿Cuánto recibiste después del cambio?')
      else if (!event.destinationCurrency) questions.push(`¿${event.destinationAmount} en qué moneda los recibiste?`)
    }
    if (event.type === 'transfer' && !event.destinationAccountHint) {
      questions.push('¿A qué cuenta lo pasaste?')
    }
  }

  if (questions.length) {
    return {
      kind: 'needs_clarification',
      question: questions[0],
      partial: events,
      source: result.source,
    }
  }

  return { kind: 'events', events, source: result.source }
}

function enrichEvent(event: ParsedFinanceEvent, book: FinanceBook): ParsedFinanceEvent {
  const next = { ...event }
  if (next.accountHint) {
    const match = findAccount(book, next.accountHint)
    if (match) {
      next.accountHint = match.name
      next.currency = next.currency ?? match.currency
    }
  }
  if (next.destinationAccountHint) {
    const match = findAccount(book, next.destinationAccountHint)
    if (match) next.destinationAccountHint = match.name
  }
  if (next.type === 'exchange' && next.amount && next.destinationAmount && next.currency && next.destinationCurrency) {
    next.impliedRate = impliedRate(next.amount, next.destinationAmount)
    next.rateQuote = rateQuote(next.amount, next.currency, next.destinationAmount, next.destinationCurrency)?.quote
  }
  if (next.feeAmount && next.destinationAmount && next.feeCurrency === next.destinationCurrency) {
    /* fee is represented separately; destination already net if user said "recibí" */
  }
  return next
}

function questionForMissingAmount(event: ParsedFinanceEvent) {
  if (event.type === 'exchange') return '¿Cuánto cambiaste y cuánto recibiste?'
  if (event.currency) return `¿Cuántos ${event.currency} fueron?`
  return '¿Qué cantidad quieres registrar?'
}
