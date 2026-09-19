import type { ChartPoint, RecordItem, Workspace } from '../domain/types'
import { daysFromNow, parseDate, startOfDay, toIsoDate } from '../lib/dates'
import { formatAmount, formatNumber } from '../lib/format'
import {
  isBacklogStatus,
  readSchema,
  recordDateValue,
  recordNumber,
  recordText,
  signedAmount,
} from '../lib/schema'
import { computeBooleanCoverage } from './coverage'

export type TrendDirection = 'up' | 'down' | 'flat'
export type ChangePolarity = 'higher_better' | 'lower_better' | 'neutral'
export type ChangeTone = 'grow' | 'ease' | 'steady' | 'fresh' | 'quiet'

export interface AreaProgress {
  workspaceId: string
  workspaceName: string
  icon: string
  color: string
  kind: Workspace['kind']
  label: string
  unit?: string
  periodLabel: string
  current: number
  previous: number
  display: string
  shortDisplay: string
  observation: string
  comparison: string
  absoluteDeltaLabel: string | null
  percentLabel: string | null
  contextNote: string | null
  polarity: ChangePolarity
  tone: ChangeTone
  direction: TrendDirection
  deltaPercent: number | null
  weeklyAverage: number
  history: number[]
  points: ChartPoint[]
  weeklyHistory: number[]
  isFourWeekHigh: boolean
}

export interface ProgressObservation {
  primary: string
  context?: string
  secondary?: string
}

function recordTime(workspace: Workspace, record: RecordItem) {
  return parseDate(recordDateValue(workspace, record)) ?? parseDate(record.createdAt)
}

function inRange(workspace: Workspace, record: RecordItem, start: Date, endExclusive: Date) {
  const date = recordTime(workspace, record)
  if (!date) return false
  return date >= start && date < endExclusive
}

function weekRange(offsetWeeks = 0) {
  const end = startOfDay(daysFromNow(1 - offsetWeeks * 7))
  const start = startOfDay(daysFromNow(-6 - offsetWeeks * 7))
  return { start, end }
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function directionOf(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

function polarityFor(workspace: Workspace, noun: string): ChangePolarity {
  if (noun === 'gastos' || /gasto/.test(noun)) return 'lower_better'
  if (workspace.kind === 'finance' && noun !== 'ahorro') return 'lower_better'
  if (workspace.kind === 'custom') return 'neutral'
  return 'higher_better'
}

function toneFor(
  current: number,
  previous: number,
  polarity: ChangePolarity,
  weeksWithData: number,
): ChangeTone {
  if (current === 0 && previous === 0) return 'quiet'
  if (previous === 0 && current > 0) return 'fresh'
  const direction = directionOf(current, previous)
  if (direction === 'flat' || (percentDelta(current, previous) !== null && Math.abs(percentDelta(current, previous) ?? 0) < 10)) {
    return 'steady'
  }
  if (weeksWithData < 2) return 'fresh'
  const rising = direction === 'up'
  if (polarity === 'neutral') return 'steady'
  if (polarity === 'higher_better') return rising ? 'grow' : 'ease'
  return rising ? 'ease' : 'grow'
}

function comparisonCopy(
  current: number,
  previous: number,
  formattedDelta: string | null,
  percent: number | null,
) {
  if (current === 0 && previous === 0) return 'sin suficiente información'
  if (previous === 0) return 'primera semana registrada'
  if (percent === null || percent === 0) return 'similar a tu promedio'
  return formattedDelta ?? 'cambio frente a la semana anterior'
}

function nounFor(workspace: Workspace) {
  const schema = readSchema(workspace)
  if (schema.identifier?.label) return schema.identifier.label.toLowerCase()
  if (workspace.kind === 'crm') return 'contactos'
  if (workspace.kind === 'fitness') return 'km'
  if (workspace.kind === 'habits') return 'días'
  return 'registros'
}

function measureFinance(workspace: Workspace, records: RecordItem[]) {
  const events = workspace.finance?.events.length
    ? workspace.finance.events.filter((event) =>
        records.some((record) => Math.abs((parseDate(event.date)?.getTime() ?? 0) - (recordTime(workspace, record)?.getTime() ?? 0)) < 86400000) ||
        records.some((record) => record.createdAt.slice(0, 10) === event.date.slice(0, 10)),
      )
    : []
  if (!events.length) return null
  const display = workspace.finance?.setup.displayCurrency
  const expenses = events.filter((event) => event.type === 'expense' || event.type === 'fee')
  const currencies = new Set(expenses.map((event) => event.currency))
  const currency = display && expenses.some((event) => event.currency === display)
    ? display
    : [...currencies][0]
  const value = expenses.filter((event) => event.currency === currency).reduce((sum, event) => sum + event.amount, 0)
  return { value, unit: currency, noun: 'gastos' as const }
}

function measure(workspace: Workspace, records: RecordItem[]) {
  const finance = workspace.kind === 'finance' ? measureFinance(workspace, records) : null
  if (finance) return finance
  const schema = readSchema(workspace)
  if (schema.booleanGoal) {
    const done = records.filter((record) => record.values[schema.booleanGoal!.key] === true).length
    return { value: done, unit: undefined as string | undefined, noun: 'días' }
  }
  if (schema.amount && schema.flowCategory) {
    const saving = records.reduce((sum, record) => {
      const kind = recordText(record, schema.flowCategory).toLowerCase()
      const amount = signedAmount(record, schema)
      if (/ahorro|saving/.test(kind)) return sum + (amount.income || amount.total || recordNumber(record, schema.amount))
      return sum
    }, 0)
    if (saving > 0) return { value: saving, unit: schema.amount.unit, noun: 'ahorro' }
    const expense = records.reduce((sum, record) => sum + signedAmount(record, schema).expense, 0)
    return { value: expense, unit: schema.amount.unit, noun: 'gastos' }
  }
  if (schema.amount) {
    const total = records.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
    return { value: total, unit: schema.amount.unit, noun: schema.amount.label.toLowerCase() }
  }
  if (schema.status) {
    const contacted = records.filter(
      (record) => !isBacklogStatus(recordText(record, schema.status), schema.status),
    ).length
    return { value: contacted, unit: undefined, noun: nounFor(workspace) }
  }
  return { value: records.length, unit: undefined, noun: 'registros' }
}

function formatMeasure(value: number, unit: string | undefined, noun: string) {
  if (unit) return formatAmount(value, unit)
  return `${formatNumber(value)} ${noun}`
}

function observationFor(workspace: Workspace, value: number, unit: string | undefined, noun: string) {
  const display = formatMeasure(value, unit, noun)
  if (value <= 0) return `Esta semana no hubo movimiento en ${workspace.name}.`
  if (workspace.kind === 'crm' || Boolean(readSchema(workspace).status)) {
    return `Has contactado ${display} esta semana.`
  }
  if (workspace.kind === 'fitness' || /km/i.test(unit ?? '')) {
    return `Has registrado ${display} esta semana.`
  }
  if (workspace.kind === 'finance') {
    return noun === 'ahorro'
      ? `Has ahorrado ${display} esta semana.`
      : `Esta semana gastaste ${display}.`
  }
  if (workspace.kind === 'habits') {
    const coverage = computeBooleanCoverage(workspace)
    if (coverage) return `Has cubierto ${coverage.doneDays} de ${coverage.windowDays} días esta semana.`
    return `Has cumplido ${display} esta semana.`
  }
  return `Has anotado ${display} esta semana.`
}

function dailyHistory(workspace: Workspace) {
  const values: number[] = []
  const points: ChartPoint[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = startOfDay(daysFromNow(-offset))
    const next = startOfDay(daysFromNow(-offset + 1))
    const records = workspace.records.filter((record) => inRange(workspace, record, day, next))
    const { value } = measure(workspace, records)
    values.push(value)
    points.push({ label: toIsoDate(day).slice(5), value })
  }
  return { values, points }
}

export function buildAreaProgress(workspace: Workspace): AreaProgress {
  const thisWeek = weekRange(0)
  const lastWeek = weekRange(1)
  const currentRecords = workspace.records.filter((record) =>
    inRange(workspace, record, thisWeek.start, thisWeek.end),
  )
  const previousRecords = workspace.records.filter((record) =>
    inRange(workspace, record, lastWeek.start, lastWeek.end),
  )
  const current = measure(workspace, currentRecords)
  const previous = measure(workspace, previousRecords)
  const weeklyHistory = [3, 2, 1, 0].map((offset) => {
    const range = weekRange(offset)
    return measure(
      workspace,
      workspace.records.filter((record) => inRange(workspace, record, range.start, range.end)),
    ).value
  })
  const history = dailyHistory(workspace)
  const currentValue = current.value
  const priorWeeks = weeklyHistory.slice(0, 3)
  const weeksWithData = weeklyHistory.filter((value) => value > 0).length
  const weeklyAverage = weeklyHistory.reduce((sum, value) => sum + value, 0) / weeklyHistory.length
  const isFourWeekHigh =
    currentValue > 0 && priorWeeks.some((value) => value > 0) && currentValue >= Math.max(...weeklyHistory)
  const isFourWeekLow =
    currentValue > 0 && priorWeeks.some((value) => value > 0) && currentValue <= Math.min(...weeklyHistory)
  const polarity = polarityFor(workspace, current.noun)
  const delta = currentValue - previous.value
  const percent = percentDelta(currentValue, previous.value)
  const absoluteDeltaLabel =
    previous.value === 0 && currentValue === 0
      ? null
      : previous.value === 0
        ? null
        : `${delta >= 0 ? '+' : ''}${formatMeasure(delta, current.unit, current.noun)} vs. semana anterior`
  const percentLabel =
    percent !== null && Math.abs(percent) > 0 && Math.abs(percent) <= 150
      ? `${percent > 0 ? '↑' : '↓'} ${formatNumber(Math.abs(percent))}%`
      : null
  let contextNote: string | null = null
  if (currentValue === 0 && previous.value === 0) contextNote = 'Sin suficiente información.'
  else if (previous.value === 0 && currentValue > 0) contextNote = 'Primera semana registrada.'
  else if (isFourWeekHigh && current.noun === 'gastos') contextNote = 'Tu mayor gasto en 4 semanas.'
  else if (isFourWeekHigh) contextNote = 'Tu semana más activa.'
  else if (isFourWeekLow && polarity === 'higher_better') contextNote = 'Tu menor registro en 4 semanas.'
  else if (percent !== null && Math.abs(percent) < 10) contextNote = 'Similar a tu promedio.'

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    icon: workspace.icon,
    color: workspace.color,
    kind: workspace.kind,
    label: current.noun,
    unit: current.unit,
    periodLabel: 'esta semana',
    current: currentValue,
    previous: previous.value,
    display: formatMeasure(currentValue, current.unit, current.noun),
    shortDisplay: formatMeasure(currentValue, current.unit, current.noun),
    observation: observationFor(workspace, currentValue, current.unit, current.noun),
    comparison: comparisonCopy(currentValue, previous.value, absoluteDeltaLabel, percent),
    absoluteDeltaLabel,
    percentLabel,
    contextNote,
    polarity,
    tone: toneFor(currentValue, previous.value, polarity, weeksWithData),
    direction: directionOf(currentValue, previous.value),
    deltaPercent: percent,
    weeklyAverage,
    history: history.values,
    points: history.points,
    weeklyHistory,
    isFourWeekHigh,
  }
}

export function buildHomeProgress(workspaces: Workspace[]) {
  return workspaces
    .map(buildAreaProgress)
    .sort((left, right) => {
      const leftMove = Math.abs(left.current - left.previous)
      const rightMove = Math.abs(right.current - right.previous)
      if (rightMove !== leftMove) return rightMove - leftMove
      return right.current - left.current
    })
}

export function buildWeeklySummary(workspaces: Workspace[]) {
  const areas = buildHomeProgress(workspaces)
  const active = areas.filter((area) => area.current > 0 || area.previous > 0)
  if (workspaces.length === 0) return 'Todavía no hay nada que resumir.'
  if (active.length === 0) {
    return workspaces.length === 1
      ? `${workspaces[0].name} está listo. Esta semana todavía no hay movimiento.`
      : `Esta semana aún no hay movimiento en tus ${workspaces.length} áreas.`
  }
  if (active.length === 1) return `Esta semana el movimiento estuvo en ${active[0].workspaceName}.`
  if (active.length === workspaces.length) {
    return `Esta semana avanzaste en tus ${workspaces.length} áreas.`
  }
  return `Esta semana avanzaste en ${active.length} de tus ${workspaces.length} áreas.`
}

export function buildProgressObservations(workspaces: Workspace[]): ProgressObservation | null {
  const areas = buildHomeProgress(workspaces)
  const lead = primaryArea(areas)
  if (!lead) return null
  if (lead.current <= 0 && lead.previous <= 0) {
    return {
      primary: `Esta semana aún no hay movimiento para observar.`,
      context: lead.contextNote ?? undefined,
    }
  }
  return {
    primary: lead.observation,
    context: lead.contextNote ?? undefined,
    secondary: lead.absoluteDeltaLabel ?? undefined,
  }
}

export function primaryArea(areas: AreaProgress[]) {
  return (
    areas.find((area) => area.isFourWeekHigh) ??
    areas.find((area) => area.direction !== 'flat') ??
    areas.find((area) => area.current > 0) ??
    areas[0]
  )
}
