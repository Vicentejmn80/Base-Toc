import type { RecordItem, Workspace } from '../domain/types'
import { parseDate, startOfDay, toIsoDate } from './dates'
import { formatNumber } from './format'
import { readSchema, recordDateValue, recordNumber, recordText, signedAmount } from './schema'

export const EXPERIMENT_STORAGE_KEY = 'nexora.experiments.v1'
export const EXPERIMENT_DAYS = 7

export interface WorkspaceExperiment {
  workspaceId: string
  descripcion: string
  metrica_a_revisar: string
  startedAt: string
  reviewAt: string
  status: 'active' | 'reviewed'
}

export interface ExperimentFacts {
  status: 'running' | 'due'
  descripcion: string
  metrica_a_revisar: string
  startedAt: string
  reviewAt: string
  daysLeft?: number
  enough: boolean
  currentCount: number
  previousCount: number
  currentLabel: string
  previousLabel: string
  summary: string
}

type Store = Record<string, WorkspaceExperiment>

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function loadStore(): Store {
  if (!canUseStorage()) return {}
  try {
    const raw = window.localStorage.getItem(EXPERIMENT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveStore(store: Store) {
  if (!canUseStorage()) return
  window.localStorage.setItem(EXPERIMENT_STORAGE_KEY, JSON.stringify(store))
}

export function getExperiment(workspaceId: string) {
  const item = loadStore()[workspaceId]
  return item && item.status === 'active' ? item : null
}

export function saveExperiment(
  workspaceId: string,
  input: { descripcion: string; metrica_a_revisar: string },
  started = new Date(),
) {
  const startedAt = started.toISOString()
  const review = new Date(started)
  review.setDate(review.getDate() + EXPERIMENT_DAYS)
  const experiment: WorkspaceExperiment = {
    workspaceId,
    descripcion: input.descripcion,
    metrica_a_revisar: input.metrica_a_revisar,
    startedAt,
    reviewAt: review.toISOString(),
    status: 'active',
  }
  const store = loadStore()
  store[workspaceId] = experiment
  saveStore(store)
  return experiment
}

export function markExperimentReviewed(workspaceId: string) {
  const store = loadStore()
  const current = store[workspaceId]
  if (!current) return
  store[workspaceId] = { ...current, status: 'reviewed' }
  saveStore(store)
}

function recordTime(workspace: Workspace, record: RecordItem) {
  return parseDate(recordDateValue(workspace, record)) ?? parseDate(record.createdAt)
}

function inRange(workspace: Workspace, record: RecordItem, start: Date, end: Date) {
  const date = recordTime(workspace, record)
  if (!date) return false
  return date >= start && date < end
}

function measure(workspace: Workspace, records: RecordItem[]) {
  const schema = readSchema(workspace)
  if (schema.booleanGoal) {
    const done = records.filter((record) => record.values[schema.booleanGoal!.key] === true).length
    return { value: done, label: `${formatNumber(done)} cumplimientos` }
  }
  if (schema.amount && schema.flowCategory) {
    const expense = records.reduce((sum, record) => sum + signedAmount(record, schema).expense, 0)
    return { value: expense, label: `${formatNumber(expense)} en gastos` }
  }
  if (schema.amount) {
    const total = records.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
    const unit = schema.amount.unit ?? ''
    return { value: total, label: `${formatNumber(total, unit && /km/i.test(unit) ? 1 : 0)} ${unit}`.trim() }
  }
  if (schema.status) {
    const moved = records.filter((record) => recordText(record, schema.status)).length
    return { value: moved, label: `${formatNumber(moved)} registros` }
  }
  return { value: records.length, label: `${formatNumber(records.length)} registros` }
}

export function describeExperiment(workspace: Workspace, now = new Date()): ExperimentFacts | null {
  const experiment = getExperiment(workspace.id)
  if (!experiment) return null
  const start = parseDate(experiment.startedAt)
  const review = parseDate(experiment.reviewAt)
  if (!start || !review) return null
  const due = startOfDay(now) >= startOfDay(review)
  const windowMs = review.getTime() - start.getTime()
  const previousStart = new Date(start.getTime() - windowMs)
  const currentRecords = workspace.records.filter((record) => inRange(workspace, record, start, due ? review : now))
  const previousRecords = workspace.records.filter((record) => inRange(workspace, record, previousStart, start))
  const current = measure(workspace, currentRecords)
  const previous = measure(workspace, previousRecords)
  const enough = currentRecords.length + previousRecords.length >= 3
  const daysLeft = Math.max(0, Math.ceil((startOfDay(review).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24)))

  const summary = enough
    ? `Durante el experimento: ${current.label}. En la ventana anterior: ${previous.label}.`
    : 'No hay suficientes registros en este período para evaluar el experimento con confianza.'

  return {
    status: due ? 'due' : 'running',
    descripcion: experiment.descripcion,
    metrica_a_revisar: experiment.metrica_a_revisar,
    startedAt: toIsoDate(start),
    reviewAt: toIsoDate(review),
    daysLeft: due ? 0 : daysLeft,
    enough,
    currentCount: currentRecords.length,
    previousCount: previousRecords.length,
    currentLabel: current.label,
    previousLabel: previous.label,
    summary,
  }
}

export function formatReviewDate(value: string) {
  const date = parseDate(value)
  if (!date) return value
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(date)
}
