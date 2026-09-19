import type { FieldValue } from '../../domain/types'
import type { FinancialEvent, FinancialEventType } from '../domain/types'

const TYPE_LABEL: Record<FinancialEventType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  exchange: 'Conversion',
  refund: 'Reembolso',
  fee: 'Comision',
  adjustment: 'Ajuste',
  other: 'Otro',
}

export function recordValuesFromEvent(event: FinancialEvent): Record<string, FieldValue> {
  const date = event.date.slice(0, 10)
  const description =
    event.type === 'exchange' && event.destinationAmount && event.destinationCurrency
      ? `${event.description} (${event.amount} ${event.currency} → ${event.destinationAmount} ${event.destinationCurrency})`
      : event.description
  return {
    fecha: date,
    tipo: TYPE_LABEL[event.type],
    categoria: event.category ?? 'Otro',
    descripcion: description,
    monto: event.amount,
  }
}
