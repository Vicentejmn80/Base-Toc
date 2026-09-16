import type { Goal, RecordItem, Workspace } from '../domain/types'
import { parseDate } from '../lib/dates'
import { formatAmount, formatNumber } from '../lib/format'
import {
  isSuccessStatus,
  readSchema,
  recordDateValue,
  recordNumber,
  recordText,
  signedAmount,
} from '../lib/schema'

export interface GoalProjection {
  goal: Goal
  current: number
  target: number
  progress: number
  displayCurrent: string
  displayTarget: string
  unitLabel: string
  projectionText: string
  hasProjection: boolean
}

function contribution(record: RecordItem, workspace: Workspace, goal: Goal) {
  const schema = readSchema(workspace)
  const label = goal.label.toLowerCase()

  if (schema.booleanGoal) {
    return record.values[schema.booleanGoal.key] === true ? 1 : 0
  }

  if (schema.amount && schema.flowCategory) {
    const signed = signedAmount(record, schema)
    if (label.includes('ahorro')) {
      const saving = schema.categories.find((field) =>
        field.options?.some((option) => /ahorro|saving/i.test(option.value)),
      )
      if (saving) return recordText(record, saving).toLowerCase().includes('ahorro') ? recordNumber(record, schema.amount) : 0
    }
    if (label.includes('ingreso')) return signed.income
    if (label.includes('gasto')) return signed.expense
    return signed.income
  }

  if (schema.amount) return recordNumber(record, schema.amount)

  if (schema.status) {
    return isSuccessStatus(recordText(record, schema.status), schema.status) ? 1 : 0
  }

  return 1
}

function currentForGoal(workspace: Workspace, goal: Goal) {
  const schema = readSchema(workspace)
  if (schema.booleanGoal && (goal.unit === '%' || !schema.amount)) {
    if (workspace.records.length === 0) return 0
    const done = workspace.records.filter((record) => record.values[schema.booleanGoal!.key] === true).length
    if (goal.unit === '%') return (done / workspace.records.length) * 100
  }
  return workspace.records.reduce((sum, record) => sum + contribution(record, workspace, goal), 0)
}

function unitForGoal(workspace: Workspace, goal: Goal) {
  if (goal.unit && goal.unit !== 'PEN') return goal.unit
  if (goal.unit === 'PEN') return 'S/'
  const schema = readSchema(workspace)
  if (schema.amount?.unit) return schema.amount.unit
  if (schema.status) return 'cierres'
  if (schema.booleanGoal) return 'cumplimientos'
  return 'registros'
}

function display(value: number, unit: string) {
  return formatAmount(value, unit)
}

function datedRecords(workspace: Workspace) {
  return workspace.records
    .map((record) => {
      const parsed = parseDate(recordDateValue(workspace, record)) ?? parseDate(record.createdAt)
      return parsed ? { record, date: parsed } : null
    })
    .filter((item): item is { record: RecordItem; date: Date } => Boolean(item))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function projectGoal(workspace: Workspace, goal: Goal): GoalProjection {
  const target = goal.target
  const unit = unitForGoal(workspace, goal)
  const current = currentForGoal(workspace, goal)
  const progress = target <= 0 ? 0 : Math.min(100, Math.max(0, (current / target) * 100))
  const schema = readSchema(workspace)

  const timeline = datedRecords(workspace)
  const enoughHistory = timeline.length >= 3

  if (!enoughHistory) {
    return {
      goal,
      current,
      target,
      progress,
      displayCurrent: display(current, unit),
      displayTarget: display(target, unit),
      unitLabel: unit,
      projectionText: 'Aún no hay suficiente historial para proyectar.',
      hasProjection: false,
    }
  }

  const first = timeline[0]
  const last = timeline[timeline.length - 1]
  const days = Math.max(1, (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24))
  const deadline = parseDate(goal.deadline)
  const now = new Date()
  const horizonDays = deadline
    ? Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 30
  const dateLabel = deadline ? 'para esa fecha' : 'en los próximos 30 días'
  const isPercent = schema.booleanGoal && unit === '%'

  if (isPercent) {
    let projectionText = `Al ritmo actual de cumplimiento, vas a quedar en ${display(current, unit)} de ${display(target, unit)} ${dateLabel}.`
    if (current >= target) {
      projectionText = 'Meta cumplida. Si mantienes este ritmo, la superarás antes del cierre.'
    }
    return {
      goal,
      current,
      target,
      progress,
      displayCurrent: display(current, unit),
      displayTarget: display(target, unit),
      unitLabel: unit,
      projectionText,
      hasProjection: true,
    }
  }

  const accumulated = timeline.reduce((sum, item) => sum + contribution(item.record, workspace, goal), 0)
  const pacePerDay = accumulated / days
  const projected = current + pacePerDay * horizonDays

  let projectionText = `Al ritmo actual, vas a llegar a ${display(projected, unit)} de ${display(target, unit)} ${dateLabel}.`
  if (pacePerDay > 0 && current < target) {
    const missing = target - current
    const daysNeeded = missing / pacePerDay
    if (deadline && daysNeeded <= horizonDays) {
      projectionText = `Vas bien: a este ritmo alcanzarías la meta ${formatNumber(
        Math.max(0, horizonDays - daysNeeded),
      )} días antes.`
    } else {
      projectionText = `Al ritmo actual, vas a llegar a ${display(projected, unit)} de ${display(target, unit)} ${dateLabel}.`
    }
  } else if (current >= target) {
    projectionText = 'Meta cumplida. Si mantienes este ritmo, la superarás antes del cierre.'
  } else if (pacePerDay <= 0) {
    projectionText = 'Tu ritmo reciente no es suficiente para proyectar avance hacia la meta.'
  }

  return {
    goal,
    current,
    target,
    progress,
    displayCurrent: display(current, unit),
    displayTarget: display(target, unit),
    unitLabel: unit,
    projectionText,
    hasProjection: true,
  }
}
