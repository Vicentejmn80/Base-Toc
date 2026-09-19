import type { FieldValue, RecordItem, Workspace } from '../domain/types'
import { daysFromNow, parseDate, startOfDay } from '../lib/dates'
import { formatNumber } from '../lib/format'
import {
  isBacklogStatus,
  isSuccessStatus,
  readSchema,
  recordDateValue,
  recordNumber,
  recordText,
  signedAmount,
} from '../lib/schema'
import { projectGoal } from './goals'

const MIN_COMPARE = 3

export interface SaveInsightInput {
  workspace: Workspace
  values: Record<string, FieldValue>
  existing?: RecordItem
}

export interface SaveInsight {
  text: string
  fragment: string
  enoughHistory: boolean
}

function asRecord(workspace: Workspace, values: Record<string, FieldValue>, existing?: RecordItem): RecordItem {
  return {
    id: existing?.id ?? '__pending__',
    workspaceId: workspace.id,
    values,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function previousRecords(workspace: Workspace, existing?: RecordItem) {
  if (!existing) return workspace.records
  return workspace.records.filter((record) => record.id !== existing.id)
}

function nextWorkspace(workspace: Workspace, incoming: RecordItem, existing?: RecordItem): Workspace {
  if (existing) {
    return {
      ...workspace,
      records: workspace.records.map((record) => (record.id === existing.id ? incoming : record)),
    }
  }
  return { ...workspace, records: [...workspace.records, incoming] }
}

function recordTime(workspace: Workspace, record: RecordItem) {
  return parseDate(recordDateValue(workspace, record)) ?? parseDate(record.createdAt)
}

function inWindow(workspace: Workspace, record: RecordItem, start: Date, endExclusive: Date) {
  const date = recordTime(workspace, record)
  if (!date) return false
  return date >= start && date < endExclusive
}

function weekBounds() {
  const tomorrow = startOfDay(daysFromNow(1))
  const thisStart = startOfDay(daysFromNow(-6))
  const prevStart = startOfDay(daysFromNow(-13))
  return {
    thisWeek: { start: thisStart, endExclusive: tomorrow },
    lastWeek: { start: prevStart, endExclusive: thisStart },
    month: { start: startOfDay(daysFromNow(-27)), endExclusive: tomorrow },
  }
}

function ordinal(n: number, gender: 'm' | 'f') {
  if (n === 1) return gender === 'f' ? 'primera' : 'primer'
  if (n === 2) return gender === 'f' ? '2da' : '2do'
  if (n === 3) return gender === 'f' ? '3ra' : '3er'
  return `${formatNumber(n)}.ª`
}

function sentence(text: string) {
  const trimmed = text.trim().replace(/\.+$/, '')
  if (!trimmed) return trimmed
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`
}

function mean(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentDelta(current: number, baseline: number) {
  if (baseline === 0) return null
  return Math.round(((current - baseline) / baseline) * 100)
}

function goalClause(workspace: Workspace) {
  const goal = workspace.goals[0]
  if (!goal) return null
  const projection = projectGoal(workspace, goal)
  if (projection.current <= 0) return null
  return `con esto, vas en ${projection.displayCurrent} de ${projection.displayTarget}`
}

function countClause(count: number, noun: string, gender: 'm' | 'f', extra = '') {
  return `es tu ${ordinal(count, gender)} ${noun}${extra} esta semana`
}

function amountCompareClause(amount: number, average: number, label: string) {
  const delta = percentDelta(amount, average)
  if (delta === null) return null
  if (Math.abs(delta) < 10) {
    return `este ${label} está dentro de tu rango usual`
  }
  const direction = delta > 0 ? 'mayor' : 'menor'
  return `este ${label} es ${formatNumber(Math.abs(delta))}% ${direction} a tu promedio de las últimas 4 semanas`
}

function financeInsight(input: SaveInsightInput, incoming: RecordItem, previous: RecordItem[]): string[] {
  const { workspace } = input
  const schema = readSchema(workspace)
  if (!schema.amount) return []
  const signed = signedAmount(incoming, schema)
  const isExpense = signed.expense > 0
  const amount = isExpense ? signed.expense : signed.income
  if (amount <= 0) return []

  const bounds = weekBounds()
  const spendCategory = schema.categories.find((field) => field.key !== schema.flowCategory?.key)
  const category = spendCategory ? recordText(incoming, spendCategory) : ''
  const label = isExpense ? (category ? `gasto de ${category.toLowerCase()}` : 'gasto') : 'ingreso'
  const clauses: string[] = []

  const monthPeers = previous.filter((record) => {
    if (!inWindow(workspace, record, bounds.month.start, bounds.month.endExclusive)) return false
    const other = signedAmount(record, schema)
    if (isExpense ? other.expense <= 0 : other.income <= 0) return false
    if (spendCategory && category) return recordText(record, spendCategory) === category
    return true
  })
  const peerAmounts = monthPeers.map((record) => {
    const other = signedAmount(record, schema)
    return isExpense ? other.expense : other.income
  })
  if (peerAmounts.length >= MIN_COMPARE) {
    const compare = amountCompareClause(amount, mean(peerAmounts), label)
    if (compare) clauses.push(compare)
  }

  const weekPeers = [...previous, incoming].filter((record) => {
    if (!inWindow(workspace, record, bounds.thisWeek.start, bounds.thisWeek.endExclusive)) return false
    const other = signedAmount(record, schema)
    return isExpense ? other.expense > 0 : other.income > 0
  })
  if (weekPeers.length > 0) {
    clauses.push(countClause(weekPeers.length, isExpense ? 'gasto' : 'ingreso', 'm', ''))
  }

  return clauses
}

function quantityInsight(input: SaveInsightInput, incoming: RecordItem, previous: RecordItem[]): string[] {
  const { workspace } = input
  const schema = readSchema(workspace)
  if (!schema.amount) return []
  const bounds = weekBounds()
  const noun = /km/i.test(schema.amount.unit ?? '') ? 'carrera' : 'sesión'
  const gender: 'm' | 'f' = noun === 'carrera' || noun === 'sesión' ? 'f' : 'm'
  const week = [...previous, incoming].filter((record) =>
    inWindow(workspace, record, bounds.thisWeek.start, bounds.thisWeek.endExclusive),
  )
  const lastWeek = previous.filter((record) =>
    inWindow(workspace, record, bounds.lastWeek.start, bounds.lastWeek.endExclusive),
  )
  const clauses: string[] = []
  if (week.length > 0) {
    clauses.push(countClause(week.length, noun, gender, ''))
  }

  const weekTotal = week.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
  const lastTotal = lastWeek.reduce((sum, record) => sum + recordNumber(record, schema.amount), 0)
  if (previous.length >= MIN_COMPARE && lastTotal > 0) {
    const delta = percentDelta(weekTotal, lastTotal)
    if (delta !== null && delta !== 0) {
      clauses.push(
        delta > 0
          ? `vas por encima de tu ritmo habitual`
          : `esta semana vas un poco por debajo de tu ritmo habitual`,
      )
    }
  }

  const recent = previous
    .filter((record) => inWindow(workspace, record, bounds.month.start, bounds.month.endExclusive))
    .map((record) => recordNumber(record, schema.amount))
    .filter((value) => value > 0)
  const current = recordNumber(incoming, schema.amount)
  if (recent.length >= MIN_COMPARE && current > 0) {
    const compare = amountCompareClause(current, mean(recent), schema.amount.label.toLowerCase())
    if (compare && Math.abs(percentDelta(current, mean(recent)) ?? 0) >= 10) {
      clauses.push(compare)
    }
  }

  return clauses
}

function habitInsight(input: SaveInsightInput, incoming: RecordItem, previous: RecordItem[]): string[] {
  const { workspace } = input
  const schema = readSchema(workspace)
  if (!schema.booleanGoal) return []
  if (incoming.values[schema.booleanGoal.key] !== true) {
    return [`anoté ${workspace.name.toLowerCase()} sin marcarlo como cumplido`]
  }
  const bounds = weekBounds()
  const identifier = schema.identifier ? recordText(incoming, schema.identifier) : ''
  const week = [...previous, incoming].filter((record) => {
    if (record.values[schema.booleanGoal!.key] !== true) return false
    if (!inWindow(workspace, record, bounds.thisWeek.start, bounds.thisWeek.endExclusive)) return false
    if (identifier && schema.identifier) return recordText(record, schema.identifier) === identifier
    return true
  })
  const extra = identifier ? ` de ${identifier}` : ''
  return [countClause(Math.max(week.length, 1), 'sesión', 'f', extra)]
}

function statusInsight(input: SaveInsightInput, incoming: RecordItem, previous: RecordItem[]): string[] {
  const { workspace } = input
  const schema = readSchema(workspace)
  if (!schema.status) return []
  const bounds = weekBounds()
  const noun = schema.identifier?.label.toLowerCase() ?? 'registro'
  const gender: 'm' | 'f' = /a$/.test(noun) ? 'f' : 'm'
  const week = [...previous, incoming].filter(
    (record) =>
      inWindow(workspace, record, bounds.thisWeek.start, bounds.thisWeek.endExclusive) &&
      !isBacklogStatus(recordText(record, schema.status), schema.status),
  )
  const lastWeek = previous.filter(
    (record) =>
      inWindow(workspace, record, bounds.lastWeek.start, bounds.lastWeek.endExclusive) &&
      !isBacklogStatus(recordText(record, schema.status), schema.status),
  )
  const clauses: string[] = []
  if (previous.length >= MIN_COMPARE && lastWeek.length > 0) {
    const delta = percentDelta(week.length, lastWeek.length)
    if (delta !== null && delta !== 0) {
      const direction = delta > 0 ? 'arriba' : 'abajo'
      clauses.push(`tu prospección va ${formatNumber(Math.abs(delta))}% ${direction} de la semana pasada`)
    }
  }
  if (week.length > 0) {
    clauses.push(countClause(week.length, noun, gender, ''))
  }
  if (isSuccessStatus(recordText(incoming, schema.status), schema.status)) {
    clauses.push(`este ${noun} ya cuenta como avance concreto`)
  }
  return clauses
}

function firstInsight(workspace: Workspace): SaveInsight {
  return {
    enoughHistory: false,
    fragment: `es el primer registro en ${workspace.name} — en unos días vas a poder ver tendencia`,
    text: 'Guardado. Es tu primer registro en este espacio — en unos días vas a poder ver tendencia.',
  }
}

export function buildSaveInsight(input: SaveInsightInput): SaveInsight {
  const previous = previousRecords(input.workspace, input.existing)
  if (previous.length === 0) return firstInsight(input.workspace)

  const incoming = asRecord(input.workspace, input.values, input.existing)
  const next = nextWorkspace(input.workspace, incoming, input.existing)
  const schema = readSchema(input.workspace)
  const clauses: string[] = []

  if (schema.booleanGoal) clauses.push(...habitInsight(input, incoming, previous))
  else if (schema.amount && schema.flowCategory) clauses.push(...financeInsight(input, incoming, previous))
  else if (schema.amount) clauses.push(...quantityInsight(input, incoming, previous))
  else if (schema.status) clauses.push(...statusInsight(input, incoming, previous))
  else {
    const bounds = weekBounds()
    const week = [...previous, incoming].filter((record) =>
      inWindow(input.workspace, record, bounds.thisWeek.start, bounds.thisWeek.endExclusive),
    )
    clauses.push(countClause(Math.max(week.length, 1), 'registro', 'm', ` en ${input.workspace.name}`))
  }

  const goal = goalClause(next)
  if (goal && previous.length >= 1) clauses.push(goal)

  const unique = [...new Set(clauses.filter(Boolean))].slice(0, 2)
  if (unique.length === 0) {
    return {
      enoughHistory: previous.length >= MIN_COMPARE,
      fragment: `quedó anotado en ${input.workspace.name}`,
      text: `Quedó anotado en ${input.workspace.name}.`,
    }
  }

  return {
    enoughHistory: previous.length >= MIN_COMPARE,
    fragment: unique[0],
    text: sentence(unique.join(' — ')),
  }
}

export function buildConsolidatedSaveInsight(insights: SaveInsight[]): SaveInsight {
  if (insights.length === 0) {
    return {
      enoughHistory: false,
      fragment: 'no había nada que anotar',
      text: 'No había nada que anotar.',
    }
  }
  if (insights.length === 1) return insights[0]
  if (insights.every((item) => !item.enoughHistory)) {
    return {
      enoughHistory: false,
      fragment: 'son los primeros registros en esos espacios — en unos días vas a poder ver tendencia',
      text: 'Guardado. Son los primeros registros en esos espacios — en unos días vas a poder ver tendencia.',
    }
  }
  const fragments = insights.map((item) => item.fragment)
  const head = fragments.slice(0, -1).join(', ')
  const fragment = `${head} y ${fragments[fragments.length - 1]}`
  return {
    enoughHistory: insights.some((item) => item.enoughHistory),
    fragment,
    text: sentence(`buen cierre: ${fragment}`),
  }
}
