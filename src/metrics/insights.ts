import type { RecordItem, Workspace } from '../domain/types'
import { isWithinDays, parseDate, startOfDay, toIsoDate } from '../lib/dates'
import { formatAmount, formatNumber, formatPercent } from '../lib/format'
import {
  isPositiveStatus,
  readSchema,
  recordDateValue,
  recordText,
  signedAmount,
} from '../lib/schema'

export interface ProactiveInsight {
  id: string
  text: string
  priority: number
}

function datedRecords(workspace: Workspace) {
  return workspace.records
    .map((record) => {
      const date = parseDate(recordDateValue(workspace, record)) ?? parseDate(record.createdAt)
      return date ? { record, date } : null
    })
    .filter((item): item is { record: RecordItem; date: Date } => Boolean(item))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

function inactivityInsight(workspace: Workspace): ProactiveInsight | null {
  const rows = datedRecords(workspace)
  if (rows.length === 0) return null
  const last = startOfDay(rows[0].date)
  const now = startOfDay(new Date())
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 3) return null
  return {
    id: 'inactivity',
    priority: 100,
    text: `Llevas ${formatNumber(days)} días sin agregar un registro en este espacio.`,
  }
}

function habitsStreakInsight(workspace: Workspace): ProactiveInsight | null {
  const schema = readSchema(workspace)
  if (!schema.booleanGoal || !schema.date) return null
  const doneByDate = new Map<string, boolean>()
  for (const record of workspace.records) {
    const day = recordText(record, schema.date)
    if (!day) continue
    if (record.values[schema.booleanGoal.key] === true) doneByDate.set(day, true)
    else if (!doneByDate.has(day)) doneByDate.set(day, false)
  }
  const monthPrefix = toIsoDate().slice(0, 7)
  const days = [...doneByDate.entries()]
    .filter(([day]) => day.startsWith(monthPrefix))
    .sort((a, b) => a[0].localeCompare(b[0]))
  if (days.length < 4) return null

  let best = 0
  let current = 0
  for (const [, done] of days) {
    if (done) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  if (best < 3) return null
  return {
    id: 'habit_streak',
    priority: 80,
    text: `Llevas ${formatNumber(best)} días seguidos cumpliendo hábitos: es tu mejor racha del mes.`,
  }
}

function categoryPerformanceInsight(workspace: Workspace): ProactiveInsight | null {
  const schema = readSchema(workspace)
  const category = schema.categories[0]
  if (!category || !schema.status) return null
  const thisMonth = toIsoDate().slice(0, 7)
  const stats = new Map<string, { total: number; positive: number }>()
  for (const record of workspace.records) {
    const date = String(recordDateValue(workspace, record) ?? '')
    if (!date.startsWith(thisMonth)) continue
    const name = recordText(record, category) || 'Sin dato'
    const item = stats.get(name) ?? { total: 0, positive: 0 }
    item.total += 1
    if (isPositiveStatus(recordText(record, schema.status), schema.status)) item.positive += 1
    stats.set(name, item)
  }
  const ranked = [...stats.entries()].filter(([, value]) => value.total >= 2)
  if (ranked.length < 2) return null
  ranked.sort((a, b) => b[1].positive / b[1].total - a[1].positive / a[1].total)
  const [topName, top] = ranked[0]
  const [secondName, second] = ranked[1]
  const topRate = (top.positive / top.total) * 100
  const secondRate = (second.positive / second.total) * 100
  if (Math.abs(topRate - secondRate) < 10) return null
  return {
    id: 'channel_compare',
    priority: 70,
    text: `Este mes ${topName} está respondiendo mejor que ${secondName} (${formatPercent(topRate)} vs ${formatPercent(secondRate)}).`,
  }
}

function spendCategoryInsight(workspace: Workspace): ProactiveInsight | null {
  const schema = readSchema(workspace)
  if (!schema.amount || !schema.flowCategory) return null
  const spendCategory = schema.categories.find((field) => field.key !== schema.flowCategory?.key)
  if (!spendCategory) return null
  const totals = new Map<string, number>()
  for (const record of workspace.records) {
    const expense = signedAmount(record, schema).expense
    if (expense <= 0) continue
    const category = recordText(record, spendCategory) || 'Otro'
    totals.set(category, (totals.get(category) ?? 0) + expense)
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length < 2 || ranked[0][1] === 0) return null
  const [topName, topValue] = ranked[0]
  const rest = ranked.slice(1).reduce((sum, [, value]) => sum + value, 0)
  if (topValue < rest * 0.4) return null
  const unit = schema.amount.unit
  return {
    id: 'category_compare',
    priority: 70,
    text: `${topName} es tu categoría de gasto más alta (${formatAmount(topValue, unit)} frente a ${formatAmount(rest, unit)} en el resto).`,
  }
}

function followUpInsight(workspace: Workspace): ProactiveInsight | null {
  const schema = readSchema(workspace)
  if (!schema.followUpDate) return null
  const due = workspace.records.filter((record) => isWithinDays(record.values[schema.followUpDate!.key], 7))
  if (due.length === 0) return null
  return {
    id: 'followup_due',
    priority: 60,
    text: `Tienes ${formatNumber(due.length)} seguimientos programados para esta semana.`,
  }
}

export function buildProactiveInsights(workspace: Workspace) {
  const insights = [
    inactivityInsight(workspace),
    habitsStreakInsight(workspace),
    categoryPerformanceInsight(workspace),
    spendCategoryInsight(workspace),
    followUpInsight(workspace),
  ].filter((item): item is ProactiveInsight => Boolean(item))

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 2)
}
