import type { RecordItem, Workspace } from '../domain/types'
import { daysFromNow, parseDate, startOfDay, toIsoDate } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { readSchema, recordText } from '../lib/schema'

export const COVERAGE_WINDOW_DAYS = 7
export const REENTRY_IDLE_DAYS = 3

export const REENTRY_MESSAGE =
  'No hace falta ponerte al día. Cuéntame solo cómo te fue hoy y retomamos desde aquí.'

export interface CoverageSnapshot {
  doneDays: number
  windowDays: number
  percent: number
  previousDoneDays: number
  previousPercent: number
}

function recordDay(workspace: Workspace, record: RecordItem) {
  const schema = readSchema(workspace)
  if (schema.date) {
    const day = recordText(record, schema.date).slice(0, 10)
    if (day) return day
  }
  const parsed = parseDate(record.createdAt)
  return parsed ? toIsoDate(parsed) : null
}

function coveredDays(workspace: Workspace) {
  const schema = readSchema(workspace)
  const days = new Set<string>()
  if (!schema.booleanGoal) return days
  for (const record of workspace.records) {
    if (record.values[schema.booleanGoal.key] !== true) continue
    const day = recordDay(workspace, record)
    if (day) days.add(day)
  }
  return days
}

function countCoveredInWindow(covered: Set<string>, startOffset: number, length: number) {
  let done = 0
  for (let offset = startOffset; offset < startOffset + length; offset += 1) {
    if (covered.has(toIsoDate(daysFromNow(-offset)))) done += 1
  }
  return done
}

export function computeBooleanCoverage(workspace: Workspace): CoverageSnapshot | null {
  const schema = readSchema(workspace)
  if (!schema.booleanGoal) return null
  const covered = coveredDays(workspace)
  const doneDays = countCoveredInWindow(covered, 0, COVERAGE_WINDOW_DAYS)
  const previousDoneDays = countCoveredInWindow(covered, COVERAGE_WINDOW_DAYS, COVERAGE_WINDOW_DAYS)
  return {
    doneDays,
    windowDays: COVERAGE_WINDOW_DAYS,
    percent: (doneDays / COVERAGE_WINDOW_DAYS) * 100,
    previousDoneDays,
    previousPercent: (previousDoneDays / COVERAGE_WINDOW_DAYS) * 100,
  }
}

export function coverageDisplay(snapshot: CoverageSnapshot) {
  return `${formatNumber(snapshot.doneDays)} de ${formatNumber(snapshot.windowDays)} días`
}

export function coverageHint(snapshot: CoverageSnapshot) {
  if (snapshot.previousDoneDays <= 0) return undefined
  if (snapshot.doneDays === snapshot.previousDoneDays) {
    return `Se mantiene en ${coverageDisplay(snapshot)}.`
  }
  if (snapshot.doneDays < snapshot.previousDoneDays) {
    return `Esta semana va ${coverageDisplay(snapshot)}; la anterior fueron ${formatNumber(snapshot.previousDoneDays)} de ${formatNumber(snapshot.windowDays)}.`
  }
  return `Esta semana va ${coverageDisplay(snapshot)}; la anterior fueron ${formatNumber(snapshot.previousDoneDays)} de ${formatNumber(snapshot.windowDays)}.`
}

export function coverageInsightText(snapshot: CoverageSnapshot) {
  if (snapshot.previousDoneDays > snapshot.doneDays) {
    return `Tu cobertura bajó un poco esta semana, de ${formatNumber(snapshot.previousDoneDays)} a ${formatNumber(snapshot.doneDays)} de ${formatNumber(snapshot.windowDays)} días.`
  }
  if (snapshot.previousDoneDays > 0 && snapshot.doneDays > snapshot.previousDoneDays) {
    return `Tu cobertura de la semana es ${coverageDisplay(snapshot)}, un poco más que la anterior.`
  }
  return `Tu cobertura de la semana es ${coverageDisplay(snapshot)}.`
}

export function daysSinceLastRecord(workspace: Workspace) {
  let latest: Date | null = null
  for (const record of workspace.records) {
    const iso = recordDay(workspace, record)
    const date = iso ? parseDate(iso) : parseDate(record.createdAt)
    if (!date) continue
    if (!latest || date > latest) latest = date
  }
  if (!latest) return null
  const last = startOfDay(latest)
  const now = startOfDay(new Date())
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
}

export function needsReentry(workspace: Workspace) {
  const days = daysSinceLastRecord(workspace)
  return days !== null && days >= REENTRY_IDLE_DAYS
}
