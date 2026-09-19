import type { RecordItem, Workspace } from '../domain/types'
import { formatAmount } from '../lib/format'
import { parseDate, toIsoDate } from '../lib/dates'
import { recordTitle } from '../lib/records'
import { readSchema, recordDateValue, recordNumber, recordText } from '../lib/schema'

export const HEATMAP_DAYS = 28

export interface HeatEntry {
  id: string
  summary: string
}

export interface HeatDay {
  date: string
  count: number
  entries: HeatEntry[]
}

function addDays(from: Date, days: number) {
  const next = new Date(from)
  next.setHours(12, 0, 0, 0)
  next.setDate(next.getDate() + days)
  return next
}

function isoDay(value: unknown) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const parsed = parseDate(value)
  return parsed ? toIsoDate(parsed) : null
}

export function summarizeRecordActivity(workspace: Workspace, record: RecordItem) {
  const schema = readSchema(workspace)
  const title = recordTitle(record, 'Registro', workspace)
  if (schema.amount) {
    const amount = recordNumber(record, schema.amount)
    if (amount) return `${title} · ${formatAmount(amount, schema.amount.unit)}`
  }
  if (schema.booleanGoal) {
    const done = record.values[schema.booleanGoal.key] === true
    return done ? title : `${title} · no cumplido`
  }
  const status = schema.status ? recordText(record, schema.status) : ''
  if (status) return `${title} · ${status}`
  return title
}

export function buildActivityHeatmap(workspace: Workspace, days = HEATMAP_DAYS, today = new Date()): HeatDay[] {
  const byDay = new Map<string, HeatEntry[]>()
  for (const record of workspace.records) {
    const day = isoDay(recordDateValue(workspace, record))
    if (!day) continue
    const list = byDay.get(day) ?? []
    list.push({ id: record.id, summary: summarizeRecordActivity(workspace, record) })
    byDay.set(day, list)
  }

  const result: HeatDay[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = toIsoDate(addDays(today, -offset))
    const entries = byDay.get(date) ?? []
    result.push({ date, count: entries.length, entries })
  }
  return result
}

export function heatIntensity(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}
