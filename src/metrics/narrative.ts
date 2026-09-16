import type { FieldValue, RecordItem, Workspace } from '../domain/types'
import { daysFromNow, parseDate, startOfDay, type PeriodKey } from '../lib/dates'
import {
  formatAmount,
  formatNumber,
  formatPace,
  formatPercent,
} from '../lib/format'
import {
  isBacklogStatus,
  isPositiveStatus,
  readSchema,
  recordDateValue,
  recordNumber,
  recordText,
  signedAmount,
} from '../lib/schema'

interface NarrativeSummary {
  title: string
  lines: string[]
  hasComparison: boolean
}

interface Range {
  start: Date
  endExclusive: Date
}

function number(value: FieldValue) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function shiftDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function periodInDays(period: PeriodKey) {
  if (period === '7d') return 7
  if (period === '30d') return 30
  if (period === '90d') return 90
  return 0
}

function getRecordDate(workspace: Workspace, record: RecordItem) {
  return parseDate(recordDateValue(workspace, record))
}

function inRange(workspace: Workspace, record: RecordItem, range: Range) {
  const date = getRecordDate(workspace, record)
  if (!date) return false
  return date >= range.start && date < range.endExclusive
}

function splitPeriods(workspace: Workspace, period: PeriodKey) {
  const days = periodInDays(period)
  const end = startOfDay(shiftDays(new Date(), 1))
  if (days === 0) {
    return {
      current: [...workspace.records],
      previous: [] as RecordItem[],
      canCompare: false,
    }
  }

  const currentStart = startOfDay(daysFromNow(-(days - 1)))
  const previousStart = startOfDay(shiftDays(currentStart, -days))

  const currentRange: Range = { start: currentStart, endExclusive: end }
  const previousRange: Range = { start: previousStart, endExclusive: currentStart }

  const current = workspace.records.filter((record) => inRange(workspace, record, currentRange))
  const previous = workspace.records.filter((record) => inRange(workspace, record, previousRange))

  return { current, previous, canCompare: current.length > 0 && previous.length > 0 }
}

function percentageDelta(current: number, previous: number) {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function trendWord(delta: number) {
  return delta > 0 ? 'subió' : delta < 0 ? 'bajó' : 'se mantuvo'
}

function crmSummary(workspace: Workspace, period: PeriodKey): NarrativeSummary {
  const schema = readSchema(workspace)
  const status = schema.status
  const { current, previous, canCompare } = splitPeriods(workspace, period)
  const contacted = (list: RecordItem[]) =>
    list.filter((record) => !isBacklogStatus(recordText(record, status), status))
  const responses = (list: RecordItem[]) =>
    list.filter((record) => isPositiveStatus(recordText(record, status), status))

  const curContacted = contacted(current).length
  const curResponses = responses(current).length
  const curRate = curContacted === 0 ? 0 : (curResponses / curContacted) * 100
  const noun = schema.identifier?.label.toLowerCase() ?? 'registros'
  const channelField = schema.categories[0]

  if (!canCompare) {
    return {
      title: 'Resumen de tu periodo',
      hasComparison: false,
      lines: [
        `En este periodo contactaste ${formatNumber(curContacted)} ${noun} y recibiste ${formatNumber(curResponses)} respuestas.`,
        `Tu tasa actual de respuesta es ${formatPercent(curRate)}.`,
        'Aún no hay suficiente historial para comparar este periodo con el anterior.',
      ],
    }
  }

  const prevContacted = contacted(previous).length
  const prevResponses = responses(previous).length
  const prevRate = prevContacted === 0 ? 0 : (prevResponses / prevContacted) * 100
  const contactDelta = percentageDelta(curContacted, prevContacted)
  const rateDelta = curRate - prevRate

  const channelStats = new Map<string, { contacted: number; replied: number }>()
  for (const record of current) {
    const channel = channelField ? recordText(record, channelField) || 'Sin canal' : 'Sin canal'
    const item = channelStats.get(channel) ?? { contacted: 0, replied: 0 }
    if (!isBacklogStatus(recordText(record, status), status)) item.contacted += 1
    if (isPositiveStatus(recordText(record, status), status)) item.replied += 1
    channelStats.set(channel, item)
  }
  const bestChannel = [...channelStats.entries()]
    .map(([channel, value]) => ({
      channel,
      rate: value.contacted === 0 ? 0 : (value.replied / value.contacted) * 100,
    }))
    .sort((a, b) => b.rate - a.rate)[0]

  return {
    title: 'Resumen de tu semana',
    hasComparison: true,
    lines: [
      contactDelta === null
        ? `Contactaste ${formatNumber(curContacted)} ${noun}; el periodo anterior no tenía base comparable.`
        : `Contactaste ${formatNumber(Math.abs(contactDelta))}% ${contactDelta >= 0 ? 'más' : 'menos'} ${noun} que el periodo anterior.`,
      `Tu tasa de respuesta ${trendWord(rateDelta)} de ${formatPercent(prevRate)} a ${formatPercent(curRate)}.`,
      bestChannel
        ? `${bestChannel.channel} es tu canal más efectivo del periodo con ${formatPercent(bestChannel.rate)} de respuesta.`
        : 'Aún no hay suficiente distribución por canal para sacar una conclusión.',
    ],
  }
}

function financeSummary(workspace: Workspace, period: PeriodKey): NarrativeSummary {
  const schema = readSchema(workspace)
  const unit = schema.amount?.unit
  const { current, previous, canCompare } = splitPeriods(workspace, period)
  const totals = (list: RecordItem[]) => {
    const income = list.reduce((sum, record) => sum + signedAmount(record, schema).income, 0)
    const expense = list.reduce((sum, record) => sum + signedAmount(record, schema).expense, 0)
    return { income, expense, balance: income - expense }
  }

  const currentTotals = totals(current)
  if (!canCompare) {
    return {
      title: 'Resumen de tu periodo',
      hasComparison: false,
      lines: [
        `Registraste ${formatAmount(currentTotals.income, unit)} de ingresos y ${formatAmount(currentTotals.expense, unit)} de gastos.`,
        `Tu balance actual es ${formatAmount(currentTotals.balance, unit)}.`,
        'Aún no hay suficiente historial para comparar este periodo con el anterior.',
      ],
    }
  }

  const previousTotals = totals(previous)
  const balanceDelta = currentTotals.balance - previousTotals.balance
  const spendCategory = schema.categories.find((field) => field.key !== schema.flowCategory?.key)

  const expensesByCategory = new Map<string, number>()
  for (const record of current.filter((item) => signedAmount(item, schema).expense > 0)) {
    const category = spendCategory ? recordText(record, spendCategory) || 'Sin categoría' : 'Sin categoría'
    expensesByCategory.set(category, (expensesByCategory.get(category) ?? 0) + signedAmount(record, schema).expense)
  }
  const topCategory = [...expensesByCategory.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    title: 'Resumen de tu semana',
    hasComparison: true,
    lines: [
      `Tu balance ${trendWord(balanceDelta)} ${formatAmount(Math.abs(balanceDelta), unit)} frente al periodo anterior.`,
      `En este periodo ingresó ${formatAmount(currentTotals.income, unit)} y salieron ${formatAmount(currentTotals.expense, unit)}.`,
      topCategory
        ? `Tu mayor gasto fue ${topCategory[0]} con ${formatAmount(topCategory[1], unit)}.`
        : 'No hay gastos registrados para identificar una categoría dominante.',
    ],
  }
}

function fitnessSummary(workspace: Workspace, period: PeriodKey): NarrativeSummary {
  const schema = readSchema(workspace)
  const { current, previous, canCompare } = splitPeriods(workspace, period)
  const distance = (list: RecordItem[]) =>
    list.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
  const avgPace = (list: RecordItem[]) => {
    const paceValues = list
      .map((record) => {
        const direct = number(record.values.ritmo)
        if (direct > 0) return direct
        const km = recordNumber(record, schema.amount)
        const minutes = schema.duration ? recordNumber(record, schema.duration) : 0
        return km > 0 && minutes > 0 ? minutes / km : 0
      })
      .filter((value) => value > 0)
    if (paceValues.length === 0) return 0
    return paceValues.reduce((sum, value) => sum + value, 0) / paceValues.length
  }

  const curDistance = distance(current)
  const curPace = avgPace(current)
  const unit = schema.amount?.unit ?? 'km'

  if (!canCompare) {
    return {
      title: 'Resumen de tu periodo',
      hasComparison: false,
      lines: [
        `Acumulaste ${formatAmount(curDistance, unit)} en ${formatNumber(current.length)} sesiones.`,
        `Tu ritmo promedio del periodo es ${formatPace(curPace)}.`,
        'Aún no hay suficiente historial para comparar este periodo con el anterior.',
      ],
    }
  }

  const prevDistance = distance(previous)
  const delta = percentageDelta(curDistance, prevDistance)
  const prevPace = avgPace(previous)
  const paceDelta = curPace - prevPace
  const longest = [...current].sort(
    (a, b) => recordNumber(b, schema.amount) - recordNumber(a, schema.amount),
  )[0]

  return {
    title: 'Resumen de tu semana',
    hasComparison: true,
    lines: [
      delta === null
        ? `Registraste ${formatAmount(curDistance, unit)}; no hay base previa para comparar.`
        : `Registraste ${formatNumber(Math.abs(delta))}% ${delta >= 0 ? 'más' : 'menos'} que el periodo anterior.`,
      `Tu ritmo promedio ${trendWord(-paceDelta)} de ${formatPace(prevPace)} a ${formatPace(curPace)}.`,
      longest
        ? `Tu sesión más larga fue de ${formatAmount(recordNumber(longest, schema.amount), unit)} (${schema.date ? recordText(longest, schema.date) : 'sin fecha'}).`
        : 'No hay sesiones suficientes para destacar un entrenamiento.',
    ],
  }
}

function habitsSummary(workspace: Workspace, period: PeriodKey): NarrativeSummary {
  const schema = readSchema(workspace)
  const { current, previous, canCompare } = splitPeriods(workspace, period)
  const rate = (list: RecordItem[]) => {
    if (list.length === 0) return 0
    const done = list.filter((record) => record.values[schema.booleanGoal!.key] === true).length
    return (done / list.length) * 100
  }

  const currentRate = rate(current)
  const doneDays = new Set(
    current
      .filter((record) => record.values[schema.booleanGoal!.key] === true)
      .map((record) => (schema.date ? recordText(record, schema.date) : record.createdAt)),
  ).size

  if (!canCompare) {
    return {
      title: 'Resumen de tu periodo',
      hasComparison: false,
      lines: [
        `Cumpliste ${formatPercent(currentRate)} de tus registros de hábito en este periodo.`,
        `Sumaste ${formatNumber(doneDays)} días con al menos un hábito marcado como cumplido.`,
        'Aún no hay suficiente historial para comparar este periodo con el anterior.',
      ],
    }
  }

  const previousRate = rate(previous)
  const rateDelta = currentRate - previousRate

  const habits = new Map<string, { total: number; done: number }>()
  for (const record of current) {
    const habit = schema.identifier ? recordText(record, schema.identifier) || 'Sin hábito' : 'Sin hábito'
    const currentHabit = habits.get(habit) ?? { total: 0, done: 0 }
    currentHabit.total += 1
    if (record.values[schema.booleanGoal!.key] === true) currentHabit.done += 1
    habits.set(habit, currentHabit)
  }
  const bestHabit = [...habits.entries()]
    .map(([name, value]) => ({
      name,
      rate: value.total === 0 ? 0 : (value.done / value.total) * 100,
    }))
    .sort((a, b) => b.rate - a.rate)[0]

  return {
    title: 'Resumen de tu semana',
    hasComparison: true,
    lines: [
      `Tu cumplimiento ${trendWord(rateDelta)} de ${formatPercent(previousRate)} a ${formatPercent(currentRate)}.`,
      `En el periodo marcaste ${formatNumber(doneDays)} días con hábitos cumplidos.`,
      bestHabit
        ? `${bestHabit.name} fue tu hábito más sólido con ${formatPercent(bestHabit.rate)} de cumplimiento.`
        : 'No hay suficientes hábitos registrados para identificar una tendencia.',
    ],
  }
}

export function buildNarrativeSummary(
  workspace: Workspace,
  period: PeriodKey,
): NarrativeSummary {
  const schema = readSchema(workspace)
  if (schema.booleanGoal) return habitsSummary(workspace, period)
  if (schema.amount && schema.flowCategory) return financeSummary(workspace, period)
  if (schema.amount && /km/i.test(schema.amount.unit ?? '')) return fitnessSummary(workspace, period)
  if (schema.status) return crmSummary(workspace, period)

  const { current, previous, canCompare } = splitPeriods(workspace, period)
  const delta = current.length - previous.length
  return {
    title: canCompare ? 'Resumen de tu semana' : 'Resumen de tu periodo',
    hasComparison: canCompare,
    lines: canCompare
      ? [
          `Registraste ${formatNumber(current.length)} items en el periodo actual.`,
          `La actividad ${trendWord(delta)} en ${formatNumber(Math.abs(delta))} registros frente al periodo anterior.`,
          'Puedes enriquecer este espacio añadiendo campos específicos para análisis más útil.',
        ]
      : [
          `Tienes ${formatNumber(current.length)} registros en el periodo actual.`,
          'Aún no hay suficiente historial para comparar este periodo con el anterior.',
        ],
  }
}
