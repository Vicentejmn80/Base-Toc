import type {
  ChartPoint,
  ChartSlice,
  ComputedMetric,
  FieldValue,
  RecordItem,
  Workspace,
} from '../domain/types'
import { formatAmount, formatNumber, formatPace, formatPercent } from '../lib/format'
import { daysFromNow, parseDate, toIsoDate } from '../lib/dates'
import {
  isBacklogStatus,
  isMeetingStatus,
  isPositiveStatus,
  isSuccessStatus,
  readSchema,
  recordNumber,
  recordText,
  signedAmount,
} from '../lib/schema'

function num(value: FieldValue) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function text(value: FieldValue) {
  return typeof value === 'string' ? value : ''
}

function bool(value: FieldValue) {
  return value === true
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(date)
}

function lastNDaysSeries(
  records: RecordItem[],
  dateKey: string,
  days: number,
  predicate?: (record: RecordItem) => boolean,
) {
  const points: ChartPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = daysFromNow(-i)
    const iso = toIsoDate(day)
    const value = records.filter((record) => {
      const date = parseDate(record.values[dateKey] ?? record.createdAt)
      if (!date || toIsoDate(date) !== iso) return false
      return predicate ? predicate(record) : true
    }).length
    points.push({
      label: `${day.getDate()}/${day.getMonth() + 1}`,
      value,
    })
  }
  return points
}

function distribution(records: RecordItem[], key: string): ChartSlice[] {
  const map = new Map<string, number>()
  for (const record of records) {
    const label = text(record.values[key]) || 'Sin dato'
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

function pluralize(label: string) {
  if (/s$/i.test(label)) return label
  return `${label}s`
}

function statusMetrics(workspace: Workspace): ComputedMetric[] {
  const schema = readSchema(workspace)
  const status = schema.status
  if (!status) return []
  const records = workspace.records
  const valueOf = (record: RecordItem) => recordText(record, status)
  const contacted = records.filter((record) => !isBacklogStatus(valueOf(record), status)).length
  const replies = records.filter((record) => isPositiveStatus(valueOf(record), status)).length
  const meetings = records.filter((record) => isMeetingStatus(valueOf(record))).length
  const clients = records.filter((record) => isSuccessStatus(valueOf(record), status)).length
  const rate = contacted === 0 ? 0 : (replies / contacted) * 100
  const noun = schema.identifier?.label ? pluralize(schema.identifier.label) : 'Registros'
  const successLabel = status.options?.find((option) => isSuccessStatus(option.value, status))?.label ?? 'Cierre'

  return [
    {
      id: 'contacted',
      label: `${noun} contactados`,
      value: contacted,
      display: formatNumber(contacted),
      hint: status.options?.[0] ? `Todo lo que ya salió de “${status.options[0].label}”` : undefined,
    },
    {
      id: 'replies',
      label: 'Respuestas',
      value: replies,
      display: formatNumber(replies),
      hint: `${formatPercent(rate)} de tasa de respuesta`,
    },
    ...(meetings > 0 || workspace.kind === 'crm'
      ? [
          {
            id: 'meetings',
            label: 'Reuniones',
            value: meetings,
            display: formatNumber(meetings),
            hint: 'Reunión, propuesta o cliente',
          },
        ]
      : []),
    {
      id: 'clients',
      label: successLabel,
      value: clients,
      display: formatNumber(clients),
    },
  ]
}

function moneyMetrics(workspace: Workspace): ComputedMetric[] {
  const schema = readSchema(workspace)
  if (!schema.amount) return []
  const unit = schema.amount.unit
  const records = workspace.records
  if (!schema.flowCategory) {
    const total = records.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
    return [
      {
        id: 'total',
        label: schema.amount.label,
        value: total,
        display: formatAmount(total, unit),
      },
      {
        id: 'movements',
        label: 'Registros',
        value: records.length,
        display: formatNumber(records.length),
      },
    ]
  }

  const income = records.reduce((sum, record) => sum + signedAmount(record, schema).income, 0)
  const expense = records.reduce((sum, record) => sum + signedAmount(record, schema).expense, 0)
  const balance = income - expense
  return [
    { id: 'income', label: 'Ingresos', value: income, display: formatAmount(income, unit) },
    { id: 'expense', label: 'Gastos', value: expense, display: formatAmount(expense, unit) },
    { id: 'balance', label: 'Balance', value: balance, display: formatAmount(balance, unit) },
    { id: 'movements', label: 'Movimientos', value: records.length, display: formatNumber(records.length) },
  ]
}

function quantityMetrics(workspace: Workspace): ComputedMetric[] {
  const schema = readSchema(workspace)
  if (!schema.amount) return []
  const records = workspace.records
  const unit = schema.amount.unit
  const total = records.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
  const weekly = records
    .filter((record) => {
      const date = parseDate(schema.date ? record.values[schema.date.key] : record.createdAt)
      return date ? date >= daysFromNow(-7) : false
    })
    .reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)

  const paceValues = records
    .map((record) => {
      const stored = num(record.values.ritmo)
      if (stored > 0) return stored
      const dist = recordNumber(record, schema.amount)
      const dur = schema.duration ? recordNumber(record, schema.duration) : 0
      return dist > 0 && dur > 0 ? dur / dist : 0
    })
    .filter((value) => value > 0)
  const avgPace = paceValues.length ? paceValues.reduce((a, b) => a + b, 0) / paceValues.length : 0

  const metrics: ComputedMetric[] = [
    {
      id: 'distance',
      label: `${schema.amount.label} acumulado`,
      value: total,
      display: formatAmount(total, unit),
    },
    {
      id: 'weekly',
      label: 'Esta semana',
      value: weekly,
      display: formatAmount(weekly, unit),
    },
  ]
  if (schema.duration && avgPace > 0) {
    metrics.push({ id: 'pace', label: 'Ritmo promedio', value: avgPace, display: formatPace(avgPace) })
  }
  metrics.push({
    id: 'sessions',
    label: 'Sesiones',
    value: records.length,
    display: formatNumber(records.length),
  })
  return metrics
}

function habitMetrics(workspace: Workspace): ComputedMetric[] {
  const schema = readSchema(workspace)
  if (!schema.booleanGoal) return []
  const records = [...workspace.records].sort((a, b) => {
    const left = schema.date ? recordText(a, schema.date) : a.createdAt
    const right = schema.date ? recordText(b, schema.date) : b.createdAt
    return left.localeCompare(right)
  })
  const done = records.filter((record) => bool(recordValue(record, schema.booleanGoal))).length
  const rate = records.length === 0 ? 0 : (done / records.length) * 100
  let streak = 0
  const uniqueDays = [
    ...new Set(
      records
        .filter((record) => bool(recordValue(record, schema.booleanGoal)))
        .map((record) => (schema.date ? recordText(record, schema.date) : toIsoDate(parseDate(record.createdAt) ?? new Date()))),
    ),
  ]
    .filter(Boolean)
    .sort()
  const cursor = uniqueDays[uniqueDays.length - 1]
  const today = toIsoDate()
  const yesterday = toIsoDate(daysFromNow(-1))
  if (cursor === today || cursor === yesterday) {
    const daySet = new Set(uniqueDays)
    let offset = cursor === today ? 0 : 1
    while (daySet.has(toIsoDate(daysFromNow(-offset)))) {
      streak += 1
      offset += 1
    }
  }

  return [
    { id: 'done', label: 'Días cumplidos', value: done, display: formatNumber(done) },
    { id: 'streak', label: 'Racha actual', value: streak, display: `${streak} días` },
    { id: 'rate', label: 'Cumplimiento', value: rate, display: formatPercent(rate) },
    { id: 'logs', label: 'Registros', value: records.length, display: formatNumber(records.length) },
  ]
}

function recordValue(record: RecordItem, field: { key: string } | undefined) {
  if (!field) return null
  return record.values[field.key] ?? null
}

export function computeMetrics(workspace: Workspace): ComputedMetric[] {
  const schema = readSchema(workspace)
  if (schema.booleanGoal) return habitMetrics(workspace)
  if (schema.amount && schema.flowCategory) return moneyMetrics(workspace)
  if (schema.amount && /km/i.test(schema.amount.unit ?? '')) return quantityMetrics(workspace)
  if (schema.amount && !schema.status) return moneyMetrics(workspace)
  if (schema.status) return statusMetrics(workspace)
  if (schema.amount) return quantityMetrics(workspace)
  return [
    {
      id: 'records',
      label: 'Registros',
      value: workspace.records.length,
      display: formatNumber(workspace.records.length),
    },
  ]
}

export function computeTrendSeries(workspace: Workspace): { title: string; points: ChartPoint[] }[] {
  const schema = readSchema(workspace)
  const dateKey = schema.date?.key ?? 'fecha'

  if (schema.status) {
    return [
      {
        title: `Evolución de ${schema.identifier?.label ? pluralize(schema.identifier.label).toLowerCase() : 'registros'} contactados`,
        points: lastNDaysSeries(
          workspace.records,
          dateKey,
          14,
          (record) => !isBacklogStatus(recordText(record, schema.status), schema.status),
        ),
      },
      {
        title: 'Evolución de respuestas',
        points: lastNDaysSeries(workspace.records, dateKey, 14, (record) =>
          isPositiveStatus(recordText(record, schema.status), schema.status),
        ),
      },
    ]
  }

  if (schema.amount && schema.flowCategory) {
    const map = new Map<string, { income: number; expense: number }>()
    for (const record of workspace.records) {
      const date = parseDate(schema.date ? record.values[schema.date.key] : record.createdAt)
      if (!date) continue
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const current = map.get(key) ?? { income: 0, expense: 0 }
      const signed = signedAmount(record, schema)
      current.income += signed.income
      current.expense += signed.expense
      map.set(key, current)
    }
    const points = [...map.entries()].map(([key, value]) => {
      const [year, month] = key.split('-').map(Number)
      return {
        label: monthLabel(new Date(year, month, 1)),
        value: value.income - value.expense,
      }
    })
    return [{ title: 'Evolución mensual del balance', points }]
  }

  if (schema.amount) {
    return [
      {
        title: `${schema.amount.label} por registro`,
        points: workspace.records.map((record) => ({
          label: schema.date ? recordText(record, schema.date).slice(5) || '—' : '—',
          value: recordNumber(record, schema.amount),
        })),
      },
    ]
  }

  if (schema.booleanGoal) {
    return [
      {
        title: 'Cumplimientos recientes',
        points: lastNDaysSeries(workspace.records, dateKey, 14, (record) => bool(recordValue(record, schema.booleanGoal))),
      },
    ]
  }

  return [
    {
      title: 'Registros recientes',
      points: lastNDaysSeries(workspace.records, dateKey, 14),
    },
  ]
}

export function computeDistributions(workspace: Workspace): { title: string; slices: ChartSlice[] }[] {
  const schema = readSchema(workspace)
  const charts: { title: string; slices: ChartSlice[] }[] = []
  for (const category of schema.categories) {
    charts.push({
      title: `Distribución por ${category.label.toLowerCase()}`,
      slices: distribution(workspace.records, category.key),
    })
  }
  if (schema.status) {
    charts.push({ title: `Distribución por ${schema.status.label.toLowerCase()}`, slices: distribution(workspace.records, schema.status.key) })
  }
  if (schema.identifier?.type === 'select' && !schema.categories.some((field) => field.key === schema.identifier?.key)) {
    charts.push({
      title: `Por ${schema.identifier.label.toLowerCase()}`,
      slices: distribution(workspace.records, schema.identifier.key),
    })
  }
  return charts.slice(0, 2)
}

export function upcomingFollowUps(workspace: Workspace) {
  const schema = readSchema(workspace)
  if (!schema.followUpDate) return []
  return workspace.records
    .filter((record) => parseDate(record.values[schema.followUpDate!.key]))
    .sort((a, b) =>
      recordText(a, schema.followUpDate).localeCompare(recordText(b, schema.followUpDate)),
    )
    .slice(0, 6)
}
