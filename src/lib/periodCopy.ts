import type { PeriodKey } from './dates'

export function mobilePeriodLabel(period: PeriodKey) {
  if (period === '7d') return 'Tu semana'
  if (period === '30d') return 'Tu mes'
  if (period === '90d') return 'Estos meses'
  return 'Cómo te fue'
}
