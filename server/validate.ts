const FIELD_TYPES = new Set(['text', 'longText', 'number', 'date', 'select', 'boolean'])
const FIELD_ROLES = new Set(['amount', 'date', 'status', 'category', 'identifier', 'boolean_goal'])
const KINDS = new Set(['crm', 'finance', 'fitness', 'habits', 'custom'])
const ICONS = new Set(['building', 'wallet', 'activity', 'sparkles', 'layers'])

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`Falta "${field}" o no es texto.`)
  }
  return value.trim()
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asStringList(value: unknown, field: string, min: number, max: number) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new ValidationError(`"${field}" debe ser una lista de ${min} a ${max} textos.`)
  }
  const items = value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new ValidationError(`"${field}[${index}]" no es texto válido.`)
    }
    return item.trim()
  })
  return items
}

export interface ModelField {
  key: string
  label: string
  type: 'text' | 'longText' | 'number' | 'date' | 'select' | 'boolean'
  role?: 'amount' | 'date' | 'status' | 'category' | 'identifier' | 'boolean_goal'
  unit?: string
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface ModelProposal {
  name: string
  description: string
  kind: 'crm' | 'finance' | 'fitness' | 'habits' | 'custom'
  icon: string
  color: string
  rationale: string[]
  fields: ModelField[]
  goal?: {
    label: string
    target: number
    unit?: string
    deadline?: string
  }
}

export type ModelCreation =
  | { kind: 'ask'; question: string }
  | { kind: 'propose'; proposal: ModelProposal }

export function parseModelJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new ValidationError('El modelo no devolvió JSON válido.')
  }
}

export function validateCreation(value: unknown): ModelCreation {
  if (!isRecord(value)) throw new ValidationError('La respuesta del modelo no es un objeto.')
  const kind = value.kind
  if (kind === 'ask') {
    return { kind: 'ask', question: asString(value.question, 'question') }
  }
  if (kind !== 'propose') {
    throw new ValidationError('kind debe ser "ask" o "propose".')
  }
  if (!isRecord(value.proposal)) {
    throw new ValidationError('Falta proposal.')
  }
  return { kind: 'propose', proposal: validateProposal(value.proposal) }
}

function validateProposal(value: Record<string, unknown>): ModelProposal {
  const kind = asString(value.kind, 'proposal.kind')
  if (!KINDS.has(kind)) throw new ValidationError(`kind inválido: ${kind}`)
  const icon = asString(value.icon, 'proposal.icon')
  if (!ICONS.has(icon)) throw new ValidationError(`icon inválido: ${icon}`)

  const colorRaw = asString(value.color, 'proposal.color')
  const color = /^#([0-9a-fA-F]{6})$/.test(colorRaw) ? colorRaw : '#4F46E5'

  if (!Array.isArray(value.fields) || value.fields.length < 3 || value.fields.length > 8) {
    throw new ValidationError('proposal.fields debe tener entre 3 y 8 campos.')
  }

  const fields = value.fields.map((field, index) => validateField(field, index))

  let goal: ModelProposal['goal']
  if (value.goal && value.goal !== null && isRecord(value.goal)) {
    const target = Number(value.goal.target)
    const label = asOptionalString(value.goal.label)
    if (label && Number.isFinite(target) && target > 0) {
      goal = {
        label,
        target,
        unit: asOptionalString(value.goal.unit),
        deadline: asOptionalString(value.goal.deadline),
      }
    }
  }

  return {
    name: asString(value.name, 'proposal.name').slice(0, 48),
    description: asString(value.description, 'proposal.description').slice(0, 180),
    kind: kind as ModelProposal['kind'],
    icon,
    color,
    rationale: asStringList(value.rationale, 'proposal.rationale', 2, 3),
    fields,
    goal,
  }
}

function validateField(value: unknown, index: number): ModelField {
  if (!isRecord(value)) throw new ValidationError(`fields[${index}] no es un objeto.`)
  const type = asString(value.type, `fields[${index}].type`)
  if (!FIELD_TYPES.has(type)) {
    throw new ValidationError(`fields[${index}].type inválido: ${type}`)
  }

  let options: ModelField['options']
  if (type === 'select') {
    if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 8) {
      throw new ValidationError(`fields[${index}].options debe tener 2 a 8 opciones.`)
    }
    options = value.options.map((option, optionIndex) => {
      if (!isRecord(option)) {
        throw new ValidationError(`fields[${index}].options[${optionIndex}] inválido.`)
      }
      return {
        value: asString(option.value, `fields[${index}].options[${optionIndex}].value`),
        label: asString(option.label, `fields[${index}].options[${optionIndex}].label`),
      }
    })
  }

  const roleRaw = asOptionalString(value.role)
  const role = roleRaw && FIELD_ROLES.has(roleRaw) ? (roleRaw as ModelField['role']) : undefined
  const unit = asOptionalString(value.unit)

  return {
    key: asString(value.key ?? value.label, `fields[${index}].key`)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32) || `campo_${index + 1}`,
    label: asString(value.label, `fields[${index}].label`).slice(0, 40),
    type: type as ModelField['type'],
    role,
    unit,
    required: value.required === true,
    options,
    placeholder: asOptionalString(value.placeholder),
  }
}

export interface ProgressAnalysis {
  observacion: string
  hipotesis: string
  pregunta: string
  recomendacion: string
  experimento?: { descripcion: string; metrica_a_revisar: string }
  revision?: string
}

const GENERIC_RECOMMENDATION = [
  /sigue as[ií]/i,
  /s[eé] m[aá]s consistente/i,
  /mejora tu estrategia/i,
  /mant[eé]n el ritmo/i,
  /sigue contactando/i,
  /vas bien,? sigue/i,
]

export function isGenericRecommendation(text: string) {
  const value = text.trim()
  if (GENERIC_RECOMMENDATION.some((pattern) => pattern.test(value))) return true
  const hasNumber = /\d/.test(value)
  const hasAction =
    /prueba|escribe|contacta|registra|limita|cambia|reduce|env[ií]a|pregunta|anota|mide|elige|haz |dedica|corta|var[ií]a|prop[oó]n|revisa/i.test(
      value,
    )
  const hasBound = /d[ií]a|semana|hoy|mañana|contacto|registro|mensaje|sesi[oó]n/i.test(value)
  if (value.length < 40 && !hasNumber && !hasAction) return true
  if (!hasNumber && !hasAction && !hasBound) return true
  return false
}

export function validateAnalysis(value: unknown): ProgressAnalysis {
  if (!isRecord(value)) throw new ValidationError('La respuesta del modelo no es un objeto.')
  const observacion = asString(value.observacion ?? value.resumen, 'observacion').slice(0, 400)
  const hipotesis = asString(value.hipotesis, 'hipotesis').slice(0, 320)
  const pregunta = asString(value.pregunta, 'pregunta').slice(0, 220)
  const recomendacion = asString(value.recomendacion, 'recomendacion').slice(0, 360)
  if (isGenericRecommendation(recomendacion)) {
    throw new ValidationError(
      'La recomendación es demasiado genérica. Debe ser una acción concreta, con cantidad o plazo, no un lema.',
    )
  }

  const rawExperiment = isRecord(value.experimento) ? value.experimento : null
  const experimento = rawExperiment
    ? {
        descripcion: asString(rawExperiment.descripcion, 'experimento.descripcion').slice(0, 280),
        metrica_a_revisar: asString(rawExperiment.metrica_a_revisar, 'experimento.metrica_a_revisar').slice(0, 160),
      }
    : undefined

  return {
    observacion,
    hipotesis,
    pregunta,
    recomendacion,
    experimento,
    revision: asOptionalString(value.revision)?.slice(0, 400),
  }
}

export interface CaptureFieldDef {
  key: string
  label: string
  type: string
  role?: string
  unit?: string
  options?: { value: string; label: string }[]
}

export interface CaptureRecordSummary {
  id: string
  title: string
  status?: string
}

export type ModelCapture =
  | { kind: 'new_record'; values: Record<string, string | number | boolean> }
  | { kind: 'update_record'; recordId: string; values: Record<string, string | number | boolean> }
  | { kind: 'needs_disambiguation'; question: string; candidates: { id: string; title: string }[] }
  | { kind: 'needs_clarification'; question: string }
  | { kind: 'new_commitment'; description: string; dueDate: string; suggestedWorkspaceId?: string }

function coerceCaptureValue(
  field: CaptureFieldDef,
  raw: unknown,
  lenient = false,
): string | number | boolean | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined

  if (field.type === 'boolean') {
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string') {
      const text = raw.trim().toLowerCase()
      if (['true', 'si', 'sí', 'yes', '1'].includes(text)) return true
      if (['false', 'no', '0'].includes(text)) return false
    }
    if (lenient) return undefined
    throw new ValidationError(`Valor inválido para ${field.key}.`)
  }

  if (field.type === 'number') {
    const number = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
    if (!Number.isFinite(number)) {
      if (lenient) return undefined
      throw new ValidationError(`"${field.key}" debe ser un número.`)
    }
    return number
  }

  if (field.type === 'date') {
    const text = String(raw).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      if (lenient) return undefined
      throw new ValidationError(`"${field.key}" debe ser una fecha YYYY-MM-DD.`)
    }
    return text
  }

  const text = String(raw).trim()
  if (!text) return undefined

  if (field.type === 'select' && field.options?.length) {
    const match = field.options.find(
      (option) =>
        option.value.toLowerCase() === text.toLowerCase() ||
        option.label?.toLowerCase() === text.toLowerCase(),
    )
    if (!match) {
      if (lenient) return undefined
      throw new ValidationError(`"${field.key}" no coincide con una opción válida.`)
    }
    return match.value
  }

  return text
}

export function coerceCaptureValues(
  fields: CaptureFieldDef[],
  raw: unknown,
): Record<string, string | number | boolean> {
  if (!isRecord(raw)) throw new ValidationError('values debe ser un objeto.')
  const values: Record<string, string | number | boolean> = {}
  for (const field of fields) {
    if (!(field.key in raw)) continue
    const coerced = coerceCaptureValue(field, raw[field.key])
    if (coerced !== undefined) values[field.key] = coerced
  }
  if (Object.keys(values).length === 0) {
    throw new ValidationError('El modelo no extrajo ningún campo válido del texto.')
  }
  return values
}

export function validateCapture(
  value: unknown,
  fields: CaptureFieldDef[],
  records: CaptureRecordSummary[],
): ModelCapture {
  if (!isRecord(value)) throw new ValidationError('La respuesta del modelo no es un objeto.')
  const kind = value.kind
  const ids = new Set(records.map((record) => record.id))

  if (kind === 'needs_clarification') {
    return { kind: 'needs_clarification', question: asString(value.question, 'question') }
  }

  if (kind === 'needs_disambiguation') {
    if (!Array.isArray(value.candidates) || value.candidates.length < 2) {
      throw new ValidationError('needs_disambiguation requiere al menos 2 candidatos.')
    }
    const candidates = value.candidates
      .map((candidate, index) => {
        if (!isRecord(candidate)) {
          throw new ValidationError(`candidates[${index}] inválido.`)
        }
        return {
          id: asString(candidate.id, `candidates[${index}].id`),
          title: asString(candidate.title, `candidates[${index}].title`),
        }
      })
      .filter((candidate) => ids.has(candidate.id))
      .slice(0, 6)
    if (candidates.length < 2) {
      throw new ValidationError('Los candidatos no coinciden con registros existentes.')
    }
    return {
      kind: 'needs_disambiguation',
      question: asString(value.question ?? '¿A cuál registro te refieres?', 'question'),
      candidates,
    }
  }

  if (kind === 'new_record') {
    return { kind: 'new_record', values: coerceCaptureValues(fields, value.values) }
  }

  if (kind === 'update_record') {
    const recordId = asString(value.recordId, 'recordId')
    if (!ids.has(recordId)) {
      throw new ValidationError('recordId no coincide con un registro existente.')
    }
    return {
      kind: 'update_record',
      recordId,
      values: coerceCaptureValues(fields, value.values),
    }
  }

  if (kind === 'new_commitment') {
    const dueDate = asString(value.dueDate, 'dueDate')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new ValidationError('dueDate debe ser YYYY-MM-DD.')
    }
    return {
      kind: 'new_commitment',
      description: asString(value.description, 'description'),
      dueDate,
      suggestedWorkspaceId: asOptionalString(value.suggestedWorkspaceId),
    }
  }

  throw new ValidationError(
    'kind debe ser new_record, update_record, new_commitment, needs_disambiguation o needs_clarification.',
  )
}

export interface GlobalWorkspaceDef {
  id: string
  name: string
  kind?: string
  description?: string
  fields: CaptureFieldDef[]
  records: CaptureRecordSummary[]
}

export type ModelGlobalIntent = {
  id: string
  workspaceId: string
  capture: ModelCapture
}

export type ModelGlobalCapture =
  | { kind: 'create_space'; seed: string }
  | { kind: 'needs_clarification'; question: string }
  | { kind: 'intents'; intents: ModelGlobalIntent[]; createSpace?: { seed: string }; commitments?: ModelCaptureCommitment[] }

export interface ModelCaptureCommitment {
  description: string
  dueDate: string
  suggestedWorkspaceId?: string
}

function asCreateSeed(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.seed === 'string' && value.seed.trim()) {
    return value.seed.trim()
  }
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

export function validateGlobalCapture(
  value: unknown,
  workspaces: GlobalWorkspaceDef[],
  userMessage: string,
): ModelGlobalCapture {
  if (!isRecord(value)) throw new ValidationError('La respuesta del modelo no es un objeto.')
  const kind = value.kind
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]))

  if (kind === 'needs_clarification' && !Array.isArray(value.intents)) {
    return { kind: 'needs_clarification', question: asString(value.question, 'question') }
  }

  if (kind === 'create_space') {
    return { kind: 'create_space', seed: asCreateSeed(value.seed, userMessage) }
  }

  if (kind === 'new_commitment') {
    const dueDate = asString(value.dueDate, 'dueDate')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new ValidationError('dueDate debe ser YYYY-MM-DD.')
    }
    const suggested = asOptionalString(value.suggestedWorkspaceId)
    return {
      kind: 'intents',
      intents: [],
      commitments: [
        {
          description: asString(value.description, 'description'),
          dueDate,
          suggestedWorkspaceId: suggested && byId.has(suggested) ? suggested : undefined,
        },
      ],
    }
  }

  if (kind !== 'intents') {
    throw new ValidationError('kind debe ser intents, create_space, new_commitment o needs_clarification.')
  }

  if (value.intents !== undefined && !Array.isArray(value.intents)) {
    throw new ValidationError('intents debe ser una lista.')
  }

  const intents: ModelGlobalIntent[] = []
  const commitments: ModelCaptureCommitment[] = []
  const rawIntents = Array.isArray(value.intents) ? value.intents : []
  rawIntents.forEach((raw, index) => {
    if (!isRecord(raw)) throw new ValidationError(`intents[${index}] no es un objeto.`)
    if (raw.kind === 'new_commitment') {
      const dueDate = asString(raw.dueDate, `intents[${index}].dueDate`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        throw new ValidationError(`intents[${index}].dueDate debe ser YYYY-MM-DD.`)
      }
      const suggested = asOptionalString(raw.suggestedWorkspaceId ?? raw.workspaceId)
      commitments.push({
        description: asString(raw.description, `intents[${index}].description`),
        dueDate,
        suggestedWorkspaceId: suggested && byId.has(suggested) ? suggested : undefined,
      })
      return
    }
    const workspaceId = asString(raw.workspaceId, `intents[${index}].workspaceId`)
    const workspace = byId.get(workspaceId)
    if (!workspace) {
      throw new ValidationError(`intents[${index}].workspaceId no existe.`)
    }
    const capture = validateCapture(raw, workspace.fields, workspace.records)
    intents.push({
      id: `intent_${index + 1}`,
      workspaceId,
      capture,
    })
  })

  if (Array.isArray(value.commitments)) {
    value.commitments.forEach((raw, index) => {
      if (!isRecord(raw)) throw new ValidationError(`commitments[${index}] no es un objeto.`)
      const dueDate = asString(raw.dueDate, `commitments[${index}].dueDate`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        throw new ValidationError(`commitments[${index}].dueDate debe ser YYYY-MM-DD.`)
      }
      const suggested = asOptionalString(raw.suggestedWorkspaceId)
      commitments.push({
        description: asString(raw.description, `commitments[${index}].description`),
        dueDate,
        suggestedWorkspaceId: suggested && byId.has(suggested) ? suggested : undefined,
      })
    })
  }

  const createSpaceRaw = value.createSpace
  const createSpace =
    createSpaceRaw && createSpaceRaw !== null
      ? { seed: asCreateSeed(createSpaceRaw, userMessage) }
      : undefined

  if (intents.length === 0 && commitments.length === 0 && createSpace) {
    return { kind: 'create_space', seed: createSpace.seed }
  }
  if (intents.length === 0 && commitments.length === 0) {
    return { kind: 'create_space', seed: userMessage }
  }

  return {
    kind: 'intents',
    intents,
    createSpace,
    commitments: commitments.length ? commitments : undefined,
  }
}

export interface ModelImportRecord {
  source: string
  values: Record<string, string | number | boolean>
  review: boolean
  reason?: string
}

export function coerceImportValues(
  fields: CaptureFieldDef[],
  raw: unknown,
): { values: Record<string, string | number | boolean>; dropped: boolean } {
  if (!isRecord(raw)) return { values: {}, dropped: true }
  const values: Record<string, string | number | boolean> = {}
  let dropped = false
  for (const field of fields) {
    if (!(field.key in raw)) continue
    const coerced = coerceCaptureValue(field, raw[field.key], true)
    if (coerced === undefined) {
      if (raw[field.key] !== null && raw[field.key] !== undefined && raw[field.key] !== '') {
        dropped = true
      }
      continue
    }
    values[field.key] = coerced
  }
  return { values, dropped }
}

export function validateImport(value: unknown, fields: CaptureFieldDef[]): { records: ModelImportRecord[] } {
  if (!isRecord(value)) throw new ValidationError('La respuesta del modelo no es un objeto.')
  if (!Array.isArray(value.records)) {
    throw new ValidationError('records debe ser una lista.')
  }
  if (value.records.length === 0) {
    throw new ValidationError('El modelo no devolvió registros.')
  }

  const records: ModelImportRecord[] = value.records.map((item, index) => {
    if (!isRecord(item)) throw new ValidationError(`records[${index}] no es un objeto.`)
    const source = typeof item.source === 'string' ? item.source.trim() : ''
    const flagged = item.review === true
    const reason = asOptionalString(item.reason)
    const coerced = coerceImportValues(fields, item.values)
    const empty = Object.keys(coerced.values).length === 0
    return {
      source,
      values: coerced.values,
      review: flagged || coerced.dropped || empty,
      reason:
        reason ??
        (empty
          ? 'No se pudieron extraer campos con confianza'
          : coerced.dropped
            ? 'Algunos campos no se pudieron interpretar'
            : undefined),
    }
  })

  return { records }
}
