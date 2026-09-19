import type { Workspace } from '../src/domain/types'
import { groupPendingCommitments } from '../src/lib/commitment'
import { amountUnitFromCurrency, formatAmount } from '../src/lib/format'
import { migrateWorkspaceFields, readSchema } from '../src/lib/schema'
import { normalizeCurrencyCode } from '../src/finance/domain/currency'
import { buildActivityHeatmap, heatIntensity } from '../src/metrics/heatmap'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const today = new Date('2026-09-19T12:00:00')

const grouped = groupPendingCommitments(
  [
    { id: 'over', description: 'Vencido', dueDate: '2026-09-17', status: 'pendiente', createdAt: '' },
    { id: 'today', description: 'Hoy', dueDate: '2026-09-19', status: 'pendiente', createdAt: '' },
    { id: 'soon', description: 'Mañana gym', dueDate: '2026-09-20', status: 'pendiente', createdAt: '' },
    { id: 'far', description: 'Octubre', dueDate: '2026-10-30', status: 'pendiente', createdAt: '' },
  ],
  today,
)
assert(grouped.overdue[0]?.id === 'over', 'overdue bucket')
assert(grouped.today[0]?.id === 'today', 'today bucket')
assert(grouped.upcoming[0]?.id === 'soon', 'upcoming 7d')
assert(grouped.upcoming.every((item) => item.id !== 'far'), 'far future hidden')
console.log('ok  commitment visibility buckets')

assert(normalizeCurrencyCode('Bs') === 'VES', 'Bs alias')
assert(amountUnitFromCurrency('VES') === 'Bs', 'VES displays as Bs')
assert(amountUnitFromCurrency('USDT') === 'USDT', 'USDT stays USDT')
assert(formatAmount(120, 'S/').includes('S/'), 'legacy S/')
assert(formatAmount(120, 'VES').startsWith('Bs'), `VES format ${formatAmount(120, 'VES')}`)
assert(formatAmount(50, 'USDT').includes('USDT'), 'USDT format')
assert(!formatAmount(120, 'VES').includes('S/'), 'preference must not keep S/')
console.log('ok  currency display mapping')

const finance = migrateWorkspaceFields({
  id: 'ws_fin',
  name: 'Finanzas personales',
  description: '',
  icon: 'wallet',
  color: '#0F766E',
  kind: 'finance',
  createdAt: '',
  updatedAt: '',
  fields: [
    { id: 'f1', key: 'fecha', label: 'Fecha', type: 'date', role: 'date' },
    { id: 'f5', key: 'monto', label: 'Monto', type: 'number', role: 'amount', unit: 'S/' },
  ],
  records: [],
  goals: [{ id: 'g1', workspaceId: 'ws_fin', label: 'Ahorro', target: 800, unit: 'S/' }],
  finance: {
    setup: { complete: true, country: 'Venezuela', displayCurrency: 'VES', extraCurrencies: ['USDT'] },
    accounts: [],
    events: [],
    categories: ['other'],
  },
} as Workspace)

const monto = finance.fields.find((field) => field.key === 'monto')
assert(monto?.unit === 'Bs', `synced unit ${monto?.unit}`)
assert(finance.goals[0]?.unit === 'Bs', `synced goal ${finance.goals[0]?.unit}`)
assert(readSchema(finance).amount?.unit === 'Bs', 'schema unit follows preference')
console.log('ok  displayCurrency syncs amount field unit')

const running: Workspace = {
  id: 'ws_run',
  name: 'Running',
  description: '',
  icon: 'activity',
  color: '#C2410C',
  kind: 'fitness',
  createdAt: '',
  updatedAt: '',
  fields: [
    { id: 'r1', key: 'fecha', label: 'Fecha', type: 'date', role: 'date' },
    { id: 'r2', key: 'distancia', label: 'Distancia', type: 'number', role: 'amount', unit: 'km' },
  ],
  records: [
    { id: 'a', workspaceId: 'ws_run', values: { fecha: '2026-09-18', distancia: 5 }, createdAt: '', updatedAt: '' },
    { id: 'b', workspaceId: 'ws_run', values: { fecha: '2026-09-18', distancia: 3 }, createdAt: '', updatedAt: '' },
    { id: 'c', workspaceId: 'ws_run', values: { fecha: '2026-09-19', distancia: 8 }, createdAt: '', updatedAt: '' },
  ],
  goals: [],
}

const heat = buildActivityHeatmap(running, 28, today)
const day18 = heat.find((day) => day.date === '2026-09-18')
const day19 = heat.find((day) => day.date === '2026-09-19')
const empty = heat.find((day) => day.date === '2026-09-17')
assert(day18?.count === 2, `two records ${day18?.count}`)
assert(day19?.count === 1, 'one record')
assert(empty?.count === 0, 'empty day')
assert(heatIntensity(0) === 0 && heatIntensity(1) === 1 && heatIntensity(2) === 2, 'intensity gradient')
assert(heat.length === 28, '28-day window')
console.log('ok  heatmap intensity from real records')

console.log('\nfase 17 checks passed')
