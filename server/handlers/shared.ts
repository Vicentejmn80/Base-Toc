import { randomUUID } from 'node:crypto'
import { completeJson, AiConfigError, AiTimeoutError } from '../openai.ts'
import { parseModelJson, ValidationError, type ModelProposal } from '../validate.ts'

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface DialogueState {
  stage: 'idle' | 'awaiting_clarification'
  initialPrompt: string
  askedCount: number
  history: HistoryTurn[]
}

export interface ExistingWorkspace {
  id: string
  name: string
  kind?: string
  description?: string
}

export function isHistoryTurn(value: unknown): value is HistoryTurn {
  if (typeof value !== 'object' || value === null) return false
  const turn = value as HistoryTurn
  return (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string'
}

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function uniqueKeys(fields: ModelProposal['fields']) {
  const used = new Set<string>()
  return fields.map((field, index) => {
    let key = field.key || `campo_${index + 1}`
    if (used.has(key)) key = `${key}_${index + 1}`
    used.add(key)
    return { ...field, key }
  })
}

export function hydrateProposal(
  proposal: ModelProposal,
  sourcePrompt: string,
  existingWorkspaces: ExistingWorkspace[],
) {
  const fields = uniqueKeys(proposal.fields).map((field) => ({
    id: `field_${randomUUID()}`,
    key: field.key,
    label: field.label,
    type: field.type,
    role: field.role,
    unit: field.unit,
    required: field.required,
    options: field.options,
    placeholder: field.placeholder,
  }))

  const existing = existingWorkspaces.find(
    (workspace) => normalizeName(workspace.name) === normalizeName(proposal.name),
  )

  return {
    name: proposal.name,
    description: proposal.description,
    icon: proposal.icon,
    color: proposal.color,
    kind: proposal.kind,
    rationale: proposal.rationale,
    fields,
    records: [],
    goals: proposal.goal
      ? [
          {
            id: `goal_${randomUUID()}`,
            workspaceId: existing?.id ?? 'draft',
            label: proposal.goal.label,
            target: proposal.goal.target,
            unit: proposal.goal.unit,
            deadline: proposal.goal.deadline,
          },
        ]
      : [],
    existingWorkspaceId: existing?.id,
    recognized: true,
    sourcePrompt,
  }
}

const CAPTURE_STOP_WORDS = new Set([
  'colegio',
  'contacte',
  'actualiza',
  'actualizar',
  'estado',
  'respondio',
  'registro',
  'quiero',
  'pasar',
  'cliente',
])

export function captureTokenHits(
  message: string,
  records: { id: string; title: string }[],
) {
  const text = normalizeName(message)
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !CAPTURE_STOP_WORDS.has(word))
  for (const word of words) {
    const hits = records.filter((record) => normalizeName(record.title).includes(word))
    if (hits.length >= 2) return hits
  }
  return []
}

export function idleState(): DialogueState {
  return { stage: 'idle', initialPrompt: '', askedCount: 0, history: [] }
}

export async function runValidated<T>(
  system: string,
  messages: HistoryTurn[],
  validate: (value: unknown) => T,
  timeoutMs?: number,
): Promise<T> {
  try {
    const first = await completeJson({ system, messages, timeoutMs })
    return validate(parseModelJson(first))
  } catch (error) {
    if (error instanceof AiTimeoutError || error instanceof AiConfigError) throw error
    if (!(error instanceof ValidationError) && !(error instanceof Error)) throw error
    const retry = await completeJson({
      system: `${system}\n\nEl intento anterior falló la validación: ${error instanceof Error ? error.message : 'formato inválido'}. Devuelve SOLO JSON válido con la forma pedida.`,
      messages,
      timeoutMs,
    })
    return validate(parseModelJson(retry))
  }
}

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
