import type { Commitment, FieldValue, Workspace } from '../domain/types'
import { toIsoDate } from './dates'
import { createId } from './id'
import { readSchema } from './schema'

export interface ParsedCommitment {
  description: string
  dueDate?: string
  suggestedWorkspaceId?: string
  source: string
}

export type CommitmentParseResult =
  | { kind: 'commitments'; items: ParsedCommitment[] }
  | { kind: 'needs_clarification'; question: string; partial?: ParsedCommitment[] }
  | { kind: 'unparsed' }

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
}

export function foldText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const FUTURE_RE =
  /\b(manana|pasado manana|proximo|proxima|siguiente|antes del|para el|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo|la proxima|tengo que|debo|hay que|voy a|vamos a)\b/i
const PAST_RE =
  /\b(ayer|anteayer|gaste|pague|pague|corri|lei|hice|compre|contacte|anote|registre|cumpl[ií]|corrimos|pagamos)\b/i

function addDays(from: Date, days: number) {
  const next = new Date(from)
  next.setDate(next.getDate() + days)
  return next
}

function nextWeekday(from: Date, weekday: number) {
  const current = from.getDay()
  const delta = weekday === current ? 0 : (weekday + 7 - current) % 7
  return addDays(from, delta === 0 ? 0 : delta)
}

export function parseDueDate(text: string, today = new Date()): string | undefined {
  const folded = foldText(text)
  if (!folded) return undefined
  if (/\bhoy\b/.test(folded)) return toIsoDate(today)
  if (/\bpasado manana\b/.test(folded)) return toIsoDate(addDays(today, 2))
  if (/\bmanana\b/.test(folded)) return toIsoDate(addDays(today, 1))

  const iso = folded.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]

  const named = folded.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/)
  if (named) {
    const day = Number(named[1])
    const month = MONTHS[named[2]]
    const candidate = new Date(today.getFullYear(), month, day)
    if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      candidate.setFullYear(candidate.getFullYear() + 1)
    }
    return toIsoDate(candidate)
  }

  const weekdayMatch = folded.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/)
  if (weekdayMatch) {
    const weekday = WEEKDAYS.indexOf(weekdayMatch[1] as (typeof WEEKDAYS)[number])
    const base = /\bproxima?\b/.test(folded) ? addDays(today, 7) : today
    const date = nextWeekday(base, weekday)
    if (/\bproxima?\b/.test(folded) && date.getDay() === today.getDay()) {
      return toIsoDate(addDays(date, 7))
    }
    return toIsoDate(date)
  }

  return undefined
}

function looksFuture(text: string) {
  return FUTURE_RE.test(foldText(text))
}

function looksPast(text: string) {
  return PAST_RE.test(foldText(text))
}

function splitClauses(text: string) {
  return text
    .split(/\s*(?:,|;|\.)\s*|\s+(?:y|e|después|despues|luego|then)\s+/i)
    .map((part) => part.replace(/^[,.\s]+|[,.\s]+$/g, ''))
    .filter((part) => part.length > 2)
}

export function suggestWorkspaceId(description: string, workspaces: Workspace[]) {
  const text = foldText(description)
  const find = (kind: Workspace['kind'], extra?: RegExp) =>
    workspaces.find((workspace) => workspace.kind === kind && (!extra || extra.test(foldText(`${workspace.name} ${workspace.description}`)))) ??
    workspaces.find((workspace) => workspace.kind === kind)

  if (/\b(quiz|examen|prueba|matematic|tarea escolar|estudio de)\b/.test(text) && !/\b(pag|gym|gasto|dinero)\b/.test(text)) {
    return undefined
  }
  if (/\b(pag|gasto|compr|dinero|usd|euro|cuota|gym|gimnasio|membres)\b/.test(text)) {
    return find('finance')?.id
  }
  if (/\b(corr|kilometr|\bkm\b|entren|pesas|running)\b/.test(text)) return find('fitness')?.id
  if (/\b(leer|pagina|habit|medit|dorm)\b/.test(text)) return find('habits')?.id
  if (/\b(colegio|aula|contacto|cliente)\b/.test(text)) return find('crm')?.id
  return undefined
}

function cleanDescription(text: string) {
  let next = text
    .replace(/\b(hoy|manana|pasado manana|el (proximo|proxima)|la proxima semana|antes del|para el)\b/gi, ' ')
    .replace(/\b(el )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/gi, ' ')
    .replace(/\b(tengo que|debo|hay que|voy a|vamos a|tengo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim()
  next = next.replace(/^(que|de|a|un|una|el|la)\s+/i, '').trim()
  if (!next) next = text.trim()
  return next.charAt(0).toUpperCase() + next.slice(1)
}

function parseClause(text: string, workspaces: Workspace[], today: Date): ParsedCommitment {
  return {
    description: cleanDescription(text),
    dueDate: parseDueDate(text, today),
    suggestedWorkspaceId: suggestWorkspaceId(text, workspaces),
    source: text.trim(),
  }
}

export function interpretCommitment(
  text: string,
  workspaces: Workspace[],
  today = new Date(),
): CommitmentParseResult {
  const source = text.trim()
  if (!source) return { kind: 'unparsed' }

  const clauses = splitClauses(source)
  const futureClauses = clauses.filter((clause) => looksFuture(clause) && !looksPast(clause))
  const pastClauses = clauses.filter((clause) => looksPast(clause) && !looksFuture(clause))
  const mixedClauses = clauses.filter((clause) => looksFuture(clause) && looksPast(clause))

  if (mixedClauses.length && !futureClauses.length) {
    return {
      kind: 'needs_clarification',
      question: '¿Eso ya pasó o es algo que va a pasar?',
    }
  }

  if (!futureClauses.length) {
    if (looksFuture(source) && looksPast(source)) {
      return { kind: 'needs_clarification', question: '¿Eso ya pasó o es algo que va a pasar?' }
    }
    return { kind: 'unparsed' }
  }

  const items = futureClauses.map((clause) => parseClause(clause, workspaces, today))
  const missingDate = items.find((item) => !item.dueDate)
  if (missingDate) {
    return {
      kind: 'needs_clarification',
      question: '¿Para cuándo?',
      partial: items,
    }
  }

  if (pastClauses.length && items.length) {
    return { kind: 'commitments', items }
  }

  return { kind: 'commitments', items }
}

export function leftoverAfterCommitments(text: string) {
  const clauses = splitClauses(text)
  return clauses
    .filter((clause) => !(looksFuture(clause) && !looksPast(clause)))
    .join('. ')
    .trim()
}

export function isCommitmentOnlyUtterance(text: string, workspaces: Workspace[] = [], today = new Date()) {
  const parsed = interpretCommitment(text, workspaces, today)
  if (parsed.kind === 'unparsed') return false
  return leftoverAfterCommitments(text).length === 0
}

export function applyCommitmentClarification(
  source: string,
  answer: string,
  workspaces: Workspace[],
  partial?: ParsedCommitment[],
  today = new Date(),
): CommitmentParseResult {
  const combined = `${source}. ${answer}`.trim()
  const fresh = interpretCommitment(combined, workspaces, today)
  if (fresh.kind === 'commitments') return fresh
  if (!partial?.length) return fresh

  const dueDate = parseDueDate(answer, today) ?? parseDueDate(combined, today)
  const next = partial.map((item) => ({ ...item, dueDate: item.dueDate ?? dueDate }))
  if (next.some((item) => !item.dueDate)) {
    return { kind: 'needs_clarification', question: '¿Para cuándo lo dejamos?', partial: next }
  }
  return { kind: 'commitments', items: next }
}

export function dueLabel(dueDate: string, today = new Date()) {
  const todayIso = toIsoDate(today)
  const tomorrow = toIsoDate(addDays(today, 1))
  const yesterday = toIsoDate(addDays(today, -1))
  if (dueDate === todayIso) return 'Hoy'
  if (dueDate === tomorrow) return 'Mañana'
  if (dueDate === yesterday) return 'Ayer'
  const date = new Date(`${dueDate}T12:00:00`)
  return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' }).format(date)
}

export function isDueTodayOrOverdue(commitment: Commitment, today = new Date()) {
  if (commitment.status !== 'pendiente') return false
  return commitment.dueDate <= toIsoDate(today)
}

export function happenedMessage(description: string) {
  return `Ya lo hice: ${description}`
}

export function materializeCommitment(item: ParsedCommitment): Commitment {
  return {
    id: createId('cmp'),
    description: item.description,
    suggestedWorkspaceId: item.suggestedWorkspaceId,
    dueDate: item.dueDate ?? toIsoDate(),
    status: 'pendiente',
    createdAt: new Date().toISOString(),
  }
}

export function draftValuesFromCommitment(workspace: Workspace, description: string): Record<string, FieldValue> {
  const schema = readSchema(workspace)
  const values: Record<string, FieldValue> = {}
  if (schema.date) values[schema.date.key] = toIsoDate()
  const folded = foldText(description)

  if (workspace.kind === 'finance') {
    values.tipo = /ingres|cobr|me pagaron/.test(folded) ? 'Ingreso' : 'Gasto'
    values.descripcion = description
    values.categoria = /gym|gimnasio/.test(folded) ? 'Otro' : 'Otro'
    return values
  }

  if (schema.booleanGoal) {
    values[schema.booleanGoal.key] = true
    if (schema.identifier) {
      const option = schema.identifier.options?.find((item) => folded.includes(foldText(item.value)) || folded.includes(foldText(item.label)))
      values[schema.identifier.key] = option?.value ?? schema.identifier.options?.[0]?.value ?? description
    }
    const note = workspace.fields.find((field) => /nota/i.test(`${field.key} ${field.label}`))
    if (note) values[note.key] = description
    return values
  }

  if (schema.identifier) values[schema.identifier.key] = description
  const notes = workspace.fields.find((field) => /nota|desc/i.test(`${field.key} ${field.label}`))
  if (notes && values[notes.key] === undefined) values[notes.key] = description
  return values
}
