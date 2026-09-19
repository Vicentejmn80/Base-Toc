import { formatSignedMoney } from '../../finance/domain/currency'
import type { ParsedFinanceEvent } from '../../finance/domain/types'
import { Button } from '../ui/Button'

interface FinanceConfirmProps {
  events: ParsedFinanceEvent[]
  onConfirm: () => void
  onEdit: () => void
}

const TYPE_COPY: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  exchange: 'Conversión',
  refund: 'Reembolso',
  fee: 'Comisión',
  adjustment: 'Ajuste',
  other: 'Movimiento',
}

function line(event: ParsedFinanceEvent) {
  if (event.type === 'exchange' && event.amount && event.currency && event.destinationAmount && event.destinationCurrency) {
    return (
      <div className="space-y-1">
        <p className="text-[15px] text-ink">
          −{event.amount} {event.currency}
          {event.accountHint ? <span className="text-muted"> · {event.accountHint}</span> : null}
        </p>
        <p className="text-xs text-muted">↓</p>
        <p className="text-[15px] text-ink">
          +{event.destinationAmount} {event.destinationCurrency}
          {event.destinationAccountHint ? <span className="text-muted"> · {event.destinationAccountHint}</span> : null}
        </p>
        {event.rateQuote ? <p className="text-sm text-muted">Tasa: {event.rateQuote}</p> : null}
        {event.feeAmount ? (
          <p className="text-sm text-muted">
            Comisión: {event.feeAmount} {event.feeCurrency ?? event.destinationCurrency}
          </p>
        ) : null}
      </div>
    )
  }

  const signed =
    event.amount !== undefined && event.currency
      ? event.type === 'expense' || event.type === 'fee'
        ? formatSignedMoney(-event.amount, event.currency)
        : formatSignedMoney(event.amount, event.currency)
      : `${event.amount ?? ''} ${event.currency ?? ''}`.trim()

  return (
    <div>
      <p className="text-[15px] text-ink">{signed}</p>
      <p className="text-sm text-muted">
        {[event.accountHint, event.destinationAccountHint ? `→ ${event.destinationAccountHint}` : null, TYPE_COPY[event.type], event.category]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

export function FinanceConfirm({ events, onConfirm, onEdit }: FinanceConfirmProps) {
  const title =
    events.length > 1
      ? `Registraré ${events.length} movimientos`
      : events[0]?.type === 'exchange'
        ? 'Conversión'
        : 'Entendí esto'

  return (
    <div className="space-y-4" data-testid="finance-confirm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={`${event.type}-${index}`} className="rounded-2xl bg-canvas px-4 py-3">
            {line(event)}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onEdit}>
          Editar
        </Button>
        <Button onClick={onConfirm} data-testid="finance-register">
          Registrar
        </Button>
      </div>
    </div>
  )
}
