import type { FinanceBook } from '../domain/types'

export interface CurrencyBalance {
  currency: string
  amount: number
}

export interface AccountBalance {
  accountId: string
  name: string
  type: string
  currency: string
  amount: number
}

export function balancesByAccount(book: FinanceBook): AccountBalance[] {
  return book.accounts
    .filter((account) => account.active)
    .map((account) => ({
      accountId: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      amount: account.balance,
    }))
}

export function balancesByCurrency(book: FinanceBook): CurrencyBalance[] {
  const map = new Map<string, number>()
  for (const account of book.accounts) {
    if (!account.active) continue
    map.set(account.currency, Number(((map.get(account.currency) ?? 0) + account.balance).toFixed(6)))
  }
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount })).filter((item) => item.amount !== 0)
}

export function periodTotals(book: FinanceBook, fromIso: string) {
  const from = new Date(fromIso).getTime()
  let income = 0
  let expense = 0
  let conversions = 0
  const incomeCurrency = new Map<string, number>()
  const expenseCurrency = new Map<string, number>()

  for (const event of book.events) {
    if (new Date(event.date).getTime() < from) continue
    if (event.type === 'income' || event.type === 'refund') {
      income += event.amount
      incomeCurrency.set(event.currency, (incomeCurrency.get(event.currency) ?? 0) + event.amount)
    }
    if (event.type === 'expense' || event.type === 'fee') {
      expense += event.amount
      expenseCurrency.set(event.currency, (expenseCurrency.get(event.currency) ?? 0) + event.amount)
    }
    if (event.type === 'exchange') conversions += event.amount
  }

  return { income, expense, conversions, incomeCurrency, expenseCurrency }
}

export function startOfWeekIso(now = new Date()) {
  const date = new Date(now)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}
