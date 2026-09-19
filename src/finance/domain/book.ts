import { createId } from '../../lib/id'
import type { AccountKind, FinanceBook, FinancialAccount, FinancialEvent } from './types'
import { DEFAULT_FINANCE_CATEGORIES } from './types'

export function emptyFinanceBook(): FinanceBook {
  return {
    setup: { complete: false, extraCurrencies: [] },
    accounts: [],
    events: [],
    categories: [...DEFAULT_FINANCE_CATEGORIES],
  }
}

export function ensureFinanceBook(book?: FinanceBook | null): FinanceBook {
  if (!book) return emptyFinanceBook()
  return {
    setup: {
      complete: Boolean(book.setup?.complete),
      country: book.setup?.country,
      displayCurrency: book.setup?.displayCurrency,
      extraCurrencies: book.setup?.extraCurrencies ?? [],
    },
    accounts: book.accounts ?? [],
    events: book.events ?? [],
    categories: book.categories?.length ? book.categories : [...DEFAULT_FINANCE_CATEGORIES],
  }
}

export function inferAccountKind(name: string): AccountKind {
  const value = name.toLowerCase()
  if (/(efectivo|cash|caja)/.test(value)) return 'cash'
  if (/(tarjeta|card|visa|mastercard)/.test(value)) return 'card'
  if (/(exchange|binance|kraken|coinbase|okx)/.test(value)) return 'exchange'
  if (/(wise|revolut|paypal|mercadopago|n26|stripe)/.test(value)) return 'fintech'
  if (/(broker|ibkr|degiro)/.test(value)) return 'broker'
  if (/(wallet|monedero)/.test(value)) return 'wallet'
  if (/(banco|bank|cuenta)/.test(value)) return 'bank'
  return 'other'
}

export function findAccount(book: FinanceBook, hint?: string) {
  if (!hint) return undefined
  const needle = hint.trim().toLowerCase()
  return (
    book.accounts.find((account) => account.active && account.name.toLowerCase() === needle) ??
    book.accounts.find((account) => account.active && account.institution?.toLowerCase() === needle) ??
    book.accounts.find((account) => account.active && account.name.toLowerCase().includes(needle))
  )
}

export function upsertAccount(
  book: FinanceBook,
  hint: string,
  currency: string,
  type?: AccountKind,
): { book: FinanceBook; account: FinancialAccount } {
  const existing = findAccount(book, hint)
  if (existing) return { book, account: existing }
  const account: FinancialAccount = {
    id: createId('acc'),
    name: hint.trim(),
    type: type ?? inferAccountKind(hint),
    institution: hint.trim(),
    currency,
    balance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  }
  return { book: { ...book, accounts: [...book.accounts, account] }, account }
}

export function applyEventToBalances(book: FinanceBook, event: FinancialEvent): FinanceBook {
  const accounts = book.accounts.map((account) => ({ ...account }))
  const bump = (accountId: string | undefined, delta: number, currency: string) => {
    if (!accountId) return
    const account = accounts.find((item) => item.id === accountId)
    if (!account || account.currency !== currency) return
    account.balance = Number((account.balance + delta).toFixed(6))
  }

  if (event.type === 'transfer') {
    bump(event.accountId, -event.amount, event.currency)
    bump(event.counterpartyAccountId, event.amount, event.currency)
    return { ...book, accounts }
  }
  if (event.type === 'exchange') {
    bump(event.accountId, -event.amount, event.currency)
    if (event.destinationAmount && event.destinationCurrency) {
      bump(event.counterpartyAccountId, event.destinationAmount, event.destinationCurrency)
    }
    return { ...book, accounts }
  }
  const sign = event.type === 'expense' || event.type === 'fee' ? -1 : 1
  bump(event.accountId, sign * event.amount, event.currency)
  return { ...book, accounts }
}
