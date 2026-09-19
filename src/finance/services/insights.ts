import { balancesByCurrency, startOfWeekIso } from './balances'
import type { FinanceBook } from '../domain/types'

export interface FinanceInsight {
  id: string
  text: string
}

function inLastDays(iso: string, days: number) {
  return Date.now() - new Date(iso).getTime() <= days * 86400000
}

export function financeInsights(book: FinanceBook): FinanceInsight[] {
  const insights: FinanceInsight[] = []
  const recent = book.events.filter((event) => inLastDays(event.date, 28))
  if (!recent.length) return insights

  const expenses = recent.filter((event) => event.type === 'expense')
  if (expenses.length) {
    const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0]
    insights.push({
      id: 'biggest-expense',
      text: `Tu mayor gasto de las últimas 4 semanas fue ${biggest.amount} ${biggest.currency}${biggest.category ? ` en ${biggest.category}` : ''}.`,
    })
  }

  const weekStart = new Date(startOfWeekIso()).getTime()
  const weekIncome = book.events.filter((event) => event.type === 'income' && new Date(event.date).getTime() >= weekStart)
  const sources = new Set(weekIncome.map((event) => event.accountName || event.category || event.currency))
  if (sources.size >= 2) {
    insights.push({
      id: 'income-sources',
      text: `Esta semana recibiste ingresos desde ${sources.size} fuentes diferentes.`,
    })
  }

  const currencies = new Set(book.events.filter((event) => inLastDays(event.date, 7)).map((event) => event.currency))
  const weekMoves = book.events.filter((event) => inLastDays(event.date, 7)).length
  if (currencies.size > 1) {
    insights.push({
      id: 'multi-currency-week',
      text: `Esta semana utilizaste ${currencies.size} monedas en ${weekMoves} movimientos diferentes.`,
    })
  }

  const exchanges = recent.filter((event) => event.type === 'exchange' && event.currency && event.destinationCurrency)
  if (exchanges.length >= 2) {
    const pair = `${exchanges[0].currency} → ${exchanges[0].destinationCurrency}`
    const same = exchanges.filter((event) => `${event.currency} → ${event.destinationCurrency}` === pair)
    if (same.length >= 2) {
      const avg = same.reduce((sum, event) => sum + (event.impliedRate ?? 0), 0) / same.length
      insights.push({
        id: 'fx-repeat',
        text: `Has convertido ${pair} ${same.length} veces. Tasa promedio registrada: ${Number(avg.toFixed(4))}.`,
      })
    }
  }

  const now = balancesByCurrency(book)
  if (now.length) {
    const first = now[0]
    insights.push({
      id: 'currency-balance',
      text: `Saldo registrado en ${first.currency}: ${first.amount}.`,
    })
  }

  return insights.slice(0, 3)
}
