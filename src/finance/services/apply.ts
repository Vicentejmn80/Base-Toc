import { createId } from '../../lib/id'
import { applyEventToBalances, upsertAccount } from '../domain/book'
import { rateQuote } from '../domain/currency'
import type { FinanceBook, FinancialEvent, ParsedFinanceEvent } from '../domain/types'

export function commitParsedEvents(book: FinanceBook, workspaceId: string, events: ParsedFinanceEvent[]) {
  const groupId = createId('fgrp')
  let next = book
  const saved: FinancialEvent[] = []
  let previousId: string | undefined

  for (const parsed of events) {
    const built = materializeEvent(next, workspaceId, groupId, parsed, previousId)
    next = built.book
    next = { ...next, events: [...next.events, built.event] }
    next = applyEventToBalances(next, built.event)
    if (built.fee) {
      next = { ...next, events: [...next.events, built.fee] }
      next = applyEventToBalances(next, built.fee)
    }
    saved.push(built.event)
    if (built.fee) saved.push(built.fee)
    previousId = built.event.id
  }

  return { book: next, events: saved, groupId }
}

function materializeEvent(
  book: FinanceBook,
  workspaceId: string,
  groupId: string,
  parsed: ParsedFinanceEvent,
  sourceEventId?: string,
) {
  const now = new Date().toISOString()
  const amount = parsed.amount ?? 0
  const currency = parsed.currency ?? book.setup.displayCurrency ?? 'XXX'
  let next = book
  let accountId: string | undefined
  let accountName = parsed.accountHint
  let counterpartyAccountId: string | undefined
  let counterpartyAccountName = parsed.destinationAccountHint

  if (parsed.accountHint) {
    const upserted = upsertAccount(next, parsed.accountHint, currency)
    next = upserted.book
    accountId = upserted.account.id
    accountName = upserted.account.name
  }
  if (parsed.destinationAccountHint) {
    const destCurrency = parsed.destinationCurrency ?? currency
    const upserted = upsertAccount(next, parsed.destinationAccountHint, destCurrency)
    next = upserted.book
    counterpartyAccountId = upserted.account.id
    counterpartyAccountName = upserted.account.name
  } else if (parsed.type === 'exchange' && parsed.destinationCurrency) {
    const hint = parsed.accountHint ? `${parsed.accountHint} ${parsed.destinationCurrency}` : parsed.destinationCurrency
    const upserted = upsertAccount(next, hint, parsed.destinationCurrency)
    next = upserted.book
    counterpartyAccountId = upserted.account.id
    counterpartyAccountName = upserted.account.name
  }

  const rate =
    parsed.type === 'exchange' && parsed.destinationAmount && parsed.destinationCurrency
      ? rateQuote(amount, currency, parsed.destinationAmount, parsed.destinationCurrency)
      : undefined

  const event: FinancialEvent = {
    id: createId('fev'),
    workspaceId,
    groupId,
    type: parsed.type,
    amount,
    currency,
    originalAmount: amount,
    originalCurrency: currency,
    accountId,
    accountName,
    counterpartyAccountId,
    counterpartyAccountName,
    category: parsed.category,
    description: parsed.description,
    sourceEventId,
    date: parsed.date ?? now,
    destinationAmount: parsed.destinationAmount,
    destinationCurrency: parsed.destinationCurrency,
    feeAmount: parsed.feeAmount,
    feeCurrency: parsed.feeCurrency,
    impliedRate: parsed.type === 'exchange' ? parsed.impliedRate ?? rate?.rate : undefined,
    rateQuote: parsed.rateQuote ?? rate?.quote,
    createdAt: now,
  }

  let fee: FinancialEvent | undefined
  if (parsed.feeAmount && parsed.feeAmount > 0) {
    fee = {
      id: createId('fev'),
      workspaceId,
      groupId,
      type: 'fee',
      amount: parsed.feeAmount,
      currency: parsed.feeCurrency ?? parsed.destinationCurrency ?? currency,
      originalAmount: parsed.feeAmount,
      originalCurrency: parsed.feeCurrency ?? parsed.destinationCurrency ?? currency,
      accountId: counterpartyAccountId ?? accountId,
      accountName: counterpartyAccountName ?? accountName,
      category: 'fees',
      description: `Comisión de ${parsed.description}`,
      sourceEventId: event.id,
      date: event.date,
      createdAt: now,
    }
  }

  return { book: next, event, fee }
}
