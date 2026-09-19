import {
  balancesByAccount,
  balancesByCurrency,
  financeInsights,
  periodTotals,
  startOfWeekIso,
} from '../../finance'
import { formatMoney, formatSignedMoney } from '../../finance/domain/currency'
import type { FinanceBook } from '../../finance/domain/types'

export function FinancePanel({ book }: { book: FinanceBook }) {
  const currencies = balancesByCurrency(book)
  const accounts = balancesByAccount(book)
  const week = periodTotals(book, startOfWeekIso())
  const insights = financeInsights(book)
  const display = book.setup.displayCurrency
  const displayBalance = currencies.find((item) => item.currency === display)
  const others = currencies.filter((item) => item.currency !== display)

  return (
    <section className="space-y-6" data-testid="finance-panel">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Patrimonio registrado</p>
        {displayBalance ? (
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            {formatMoney(displayBalance.amount, displayBalance.currency)}
          </p>
        ) : currencies[0] ? (
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            {formatMoney(currencies[0].amount, currencies[0].currency)}
          </p>
        ) : (
          <p className="mt-2 text-lg text-muted">Todavía no hay saldos. Cuéntame qué pasó con tu dinero.</p>
        )}
        {others.length ? (
          <div className="mt-3 space-y-1 text-sm text-muted">
            {others.map((item) => (
              <p key={item.currency}>+ {formatMoney(item.amount, item.currency)}</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Esta semana</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Ingresos" value={week.income ? formatSignedMoney(week.income, display ?? dominant(week.incomeCurrency)) : '—'} />
          <Stat label="Gastos" value={week.expense ? formatSignedMoney(-week.expense, display ?? dominant(week.expenseCurrency)) : '—'} />
          <Stat label="Conversiones" value={week.conversions ? `${week.conversions}` : '—'} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Transferencias y conversiones no se cuentan como ingreso. Los montos originales se conservan.
        </p>
      </div>

      {accounts.length ? (
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Por cuenta</p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {accounts.map((account) => (
              <li key={account.accountId} className="flex justify-between gap-3">
                <span>
                  {account.name}
                  <span className="text-muted"> · {account.currency}</span>
                </span>
                <span>{formatMoney(account.amount, account.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {book.events.length ? (
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Movimientos</p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {[...book.events].reverse().slice(0, 8).map((event) => (
              <li key={event.id} className="flex justify-between gap-3">
                <span className="truncate">
                  {event.type === 'exchange' && event.destinationAmount
                    ? `${event.amount} ${event.currency} → ${event.destinationAmount} ${event.destinationCurrency}`
                    : `${event.amount} ${event.currency}`}
                  <span className="text-muted"> · {event.type}</span>
                </span>
                <span className="shrink-0 text-muted">{event.date.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {insights[0] ? (
        <div className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Observación</p>
          <p className="mt-2 text-[15px] leading-6 text-ink">{insights[0].text}</p>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}

function dominant(map: Map<string, number>) {
  let best = 'XXX'
  let max = -1
  for (const [currency, amount] of map) {
    if (amount > max) {
      best = currency
      max = amount
    }
  }
  return best
}
