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

export interface AreaProgress {
  workspaceId: string
  workspaceName: string
  icon: string
  color: string
  kind: Workspace['kind']
  label: string
  periodLabel: string
  current: number
  previous: number
  display: string
  shortDisplay: string
  observation: string
  comparison: string
  direction: TrendDirection
  deltaPercent: number | null
  history: number[]
  points: ChartPoint[]
  weeklyHistory: number[]
  isFourWeekHigh: boolean
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

function comparisonLabel(current: number, previous: number) {
  if (current === 0 && previous === 0) return 'sin movimiento vs. semana anterior'
  if (previous === 0) return 'nuevo frente a la semana anterior'
  const delta = percentDelta(current, previous)
  if (delta === null || delta === 0) return 'igual que la semana anterior'
  const arrow = delta > 0 ? '↑' : '↓'
  return `${arrow} ${formatNumber(Math.abs(delta))}% vs. semana anterior`
}

function nounFor(workspace: Workspace) {
  const schema = readSchema(workspace)
  if (schema.identifier?.label) return schema.identifier.label.toLowerCase()
  if (workspace.kind === 'crm') return 'contactos'
  if (workspace.kind === 'fitness') return 'km'
  if (workspace.kind === 'habits') return 'días'
  return 'registros'
}

function measure(workspace: Workspace, records: RecordItem[]) {
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
      : `Has anotado ${display} en gastos esta semana.`
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
  const isFourWeekHigh =
    currentValue > 0 && priorWeeks.some((value) => value > 0) && currentValue >= Math.max(...weeklyHistory)

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    icon: workspace.icon,
    color: workspace.color,
    kind: workspace.kind,
    label: current.noun,
    periodLabel: 'esta semana',
    current: currentValue,
    previous: previous.value,
    display: formatMeasure(currentValue, current.unit, current.noun),
    shortDisplay: formatMeasure(currentValue, current.unit, current.noun),
    observation: observationFor(workspace, currentValue, current.unit, current.noun),
    comparison: comparisonLabel(currentValue, previous.value),
    direction: directionOf(currentValue, previous.value),
    deltaPercent: percentDelta(currentValue, previous.value),
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

export function buildProgressObservations(workspaces: Workspace[]) {
  const areas = buildHomeProgress(workspaces)
  const lines: string[] = []
  const lead =
    areas.find((area) => area.isFourWeekHigh) ??
    areas.find((area) => area.current > 0) ??
    areas[0]
  if (lead && lead.current > 0) {
    lines.push(lead.observation)
    if (lead.isFourWeekHigh) {
      lines.push('Es tu mayor cantidad en las últimas 4 semanas.')
    } else if (lead.comparison.startsWith('↑') || lead.comparison.startsWith('↓')) {
      lines.push(lead.comparison.replace('vs. semana anterior', 'respecto de la semana anterior') + '.')
    }
  }
  return lines.slice(0, 3)
}

export function primaryArea(areas: AreaProgress[]) {
  return (
    areas.find((area) => area.isFourWeekHigh) ??
    areas.find((area) => area.direction !== 'flat') ??
    areas.find((area) => area.current > 0) ??
    areas[0]
  )
}
