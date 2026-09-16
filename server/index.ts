import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { ANALYZE_SYSTEM_PROMPT, CAPTURE_SYSTEM_PROMPT, CREATION_SYSTEM_PROMPT } from './prompts.ts'
import { AiConfigError, AiTimeoutError, completeJson } from './openai.ts'
import {
  parseModelJson,
  validateAnalysis,
  validateCapture,
  validateCreation,
  ValidationError,
  type CaptureFieldDef,
  type CaptureRecordSummary,
  type ModelProposal,
} from './validate.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

const app = express()
const port = Number(process.env.PORT) || 8787

app.use(
  cors({
    origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/],
  }),
)
app.use(express.json({ limit: '200kb' }))

interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

interface DialogueState {
  stage: 'idle' | 'awaiting_clarification'
  initialPrompt: string
  askedCount: number
  history: HistoryTurn[]
}

interface ExistingWorkspace {
  id: string
  name: string
  kind?: string
  description?: string
}

function isHistoryTurn(value: unknown): value is HistoryTurn {
  if (typeof value !== 'object' || value === null) return false
  const turn = value as HistoryTurn
  return (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string'
}

function normalizeName(value: string) {
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

function hydrateProposal(
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
  'contacte',
  'actualiza',
  'actualizar',
  'estado',
  'respondio',
  'respondio',
  'registro',
  'quiero',
  'pasar',
  'cliente',
])

function captureTokenHits(message: string, records: CaptureRecordSummary[]) {
  const text = normalizeName(message)
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !CAPTURE_STOP_WORDS.has(word))
  for (const word of words) {
    const hits = records.filter((record) => normalizeName(record.title).includes(word))
    if (hits.length >= 2) return hits
  }
  return []
}

function idleState(): DialogueState {
  return { stage: 'idle', initialPrompt: '', askedCount: 0, history: [] }
}

async function runValidated<T>(
  system: string,
  messages: HistoryTurn[],
  validate: (value: unknown) => T,
): Promise<T> {
  try {
    const first = await completeJson({ system, messages })
    return validate(parseModelJson(first))
  } catch (error) {
    if (error instanceof AiTimeoutError || error instanceof AiConfigError) throw error
    if (!(error instanceof ValidationError) && !(error instanceof Error)) throw error
    const retry = await completeJson({
      system: `${system}\n\nEl intento anterior falló la validación: ${error instanceof Error ? error.message : 'formato inválido'}. Devuelve SOLO JSON válido con la forma pedida.`,
      messages,
    })
    return validate(parseModelJson(retry))
  }
}

function errorStatus(error: unknown) {
  if (error instanceof AiConfigError) return 500
  if (error instanceof AiTimeoutError) return 504
  if (error instanceof ValidationError) return 502
  return 500
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo completar la solicitud a la IA.'
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' })
})

app.post('/api/ai/creation', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  if (!message) {
    res.status(400).json({ error: 'Escribe qué quieres crear o medir.' })
    return
  }

  const incoming = req.body?.state as Partial<DialogueState> | undefined
  const history = Array.isArray(incoming?.history)
    ? incoming.history.filter((item): item is HistoryTurn => isHistoryTurn(item)).slice(-8)
    : []
  const askedCount = typeof incoming?.askedCount === 'number' ? incoming.askedCount : 0
  const initialPrompt =
    typeof incoming?.initialPrompt === 'string' && incoming.initialPrompt.trim()
      ? incoming.initialPrompt
      : message

  const existingWorkspaces: ExistingWorkspace[] = Array.isArray(req.body?.existingWorkspaces)
    ? req.body.existingWorkspaces
        .filter((item: unknown): item is ExistingWorkspace => {
          return (
            typeof item === 'object' &&
            item !== null &&
            typeof (item as ExistingWorkspace).id === 'string' &&
            typeof (item as ExistingWorkspace).name === 'string'
          )
        })
        .map((item: ExistingWorkspace) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          description: item.description,
        }))
    : []

  const mustPropose = askedCount >= 2
  const system = `${CREATION_SYSTEM_PROMPT}

Espacios que el usuario ya tiene (no dupliques el nombre si es el mismo sistema):
${existingWorkspaces.length ? existingWorkspaces.map((item) => `- ${item.name}`).join('\n') : '- ninguno'}

Preguntas ya hechas en este diálogo: ${askedCount}.
${mustPropose ? 'Ya preguntaste suficiente. Debes devolver kind "propose".' : ''}
`

  const messages: HistoryTurn[] = [
    ...history,
    { role: 'user', content: message },
  ]

  try {
    const parsed = await runValidated(system, messages, validateCreation)
    if (parsed.kind === 'ask') {
      if (mustPropose) {
        res.status(502).json({
          error: 'El modelo no pudo proponer una estructura válida. Inténtalo de nuevo.',
        })
        return
      }
      const nextHistory: HistoryTurn[] = [
        ...messages,
        { role: 'assistant', content: parsed.question },
      ]
      res.json({
        kind: 'ask',
        question: { role: 'assistant', text: parsed.question },
        state: {
          stage: 'awaiting_clarification',
          initialPrompt,
          askedCount: askedCount + 1,
          history: nextHistory,
        },
      })
      return
    }

    res.json({
      kind: 'propose',
      proposal: hydrateProposal(
        parsed.proposal,
        initialPrompt && initialPrompt !== message ? `${initialPrompt} ${message}`.trim() : message,
        existingWorkspaces,
      ),
      state: idleState(),
    })
  } catch (error) {
    res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
})

app.post('/api/ai/capture', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  if (!message) {
    res.status(400).json({ error: 'Cuéntame qué pasó para poder interpretarlo.' })
    return
  }

  const workspace = req.body?.workspace
  if (!workspace || typeof workspace !== 'object') {
    res.status(400).json({ error: 'Falta el contexto del espacio.' })
    return
  }

  const fields: CaptureFieldDef[] = Array.isArray(workspace.fields)
    ? workspace.fields
        .filter((field: unknown): field is CaptureFieldDef => {
          return (
            typeof field === 'object' &&
            field !== null &&
            typeof (field as CaptureFieldDef).key === 'string' &&
            typeof (field as CaptureFieldDef).label === 'string' &&
            typeof (field as CaptureFieldDef).type === 'string'
          )
        })
        .map((field: CaptureFieldDef) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          role: field.role,
          unit: field.unit,
          options: field.options,
        }))
    : []

  const records: CaptureRecordSummary[] = Array.isArray(workspace.records)
    ? workspace.records
        .filter((item: unknown): item is CaptureRecordSummary => {
          return (
            typeof item === 'object' &&
            item !== null &&
            typeof (item as CaptureRecordSummary).id === 'string' &&
            typeof (item as CaptureRecordSummary).title === 'string'
          )
        })
        .map((item: CaptureRecordSummary) => ({
          id: item.id,
          title: item.title,
          status: item.status,
        }))
    : []

  const history = Array.isArray(req.body?.history)
    ? req.body.history.filter((item: unknown): item is HistoryTurn => isHistoryTurn(item)).slice(-8)
    : []

  const selectedRecordId =
    typeof req.body?.selectedRecordId === 'string' ? req.body.selectedRecordId : undefined
  const today = typeof req.body?.today === 'string' ? req.body.today : new Date().toISOString().slice(0, 10)

  const system = `${CAPTURE_SYSTEM_PROMPT}

Fecha de hoy: ${today}.
Espacio: ${workspace.name ?? 'sin nombre'} (${workspace.kind ?? 'custom'}).
Campos:
${fields.map((field) => `- ${field.key} (${field.label}, type ${field.type}${field.role ? `, role ${field.role}` : ''}${field.unit ? `, unit ${field.unit}` : ''}${field.options?.length ? `; opciones EXACTAS: ${field.options.map((option) => option.value).join(' | ')}` : ''})`).join('\n')}

Registros existentes (id · título · estado):
${records.length ? records.map((record) => `- ${record.id} · ${record.title}${record.status ? ` · ${record.status}` : ''}`).join('\n') : '- ninguno'}

${selectedRecordId ? `El usuario ya eligió el registro ${selectedRecordId}. Debes devolver update_record con ese recordId.` : ''}
${req.body?.previousProposal ? `Propuesta anterior a corregir: ${JSON.stringify(req.body.previousProposal)}` : ''}
`

  const messages: HistoryTurn[] = [...history, { role: 'user', content: message }]

  try {
    const parsed = await runValidated(system, messages, (value) =>
      validateCapture(value, fields, records),
    )

    const previousProposal = req.body?.previousProposal
    if (
      previousProposal &&
      previousProposal.kind === 'new_record' &&
      parsed.kind === 'update_record' &&
      !selectedRecordId
    ) {
      res.json({
        kind: 'new_record',
        values: {
          ...(typeof previousProposal.values === 'object' && previousProposal.values ? previousProposal.values : {}),
          ...parsed.values,
        },
      })
      return
    }

    if (selectedRecordId && records.some((record) => record.id === selectedRecordId)) {
      if (parsed.kind === 'new_record') {
        res.json({
          kind: 'update_record',
          recordId: selectedRecordId,
          values: parsed.values,
        })
        return
      }
      if (parsed.kind === 'update_record') {
        res.json({ ...parsed, recordId: selectedRecordId })
        return
      }
    }

    if (!selectedRecordId && parsed.kind === 'update_record') {
      const collisions = captureTokenHits(message, records)
      const chosen = records.find((record) => record.id === parsed.recordId)
      const uniqueMention = chosen ? normalizeName(message).includes(normalizeName(chosen.title)) : false
      if (collisions.length >= 2 && !uniqueMention) {
        res.json({
          kind: 'needs_disambiguation',
          question: 'Hay más de un registro que coincide. ¿A cuál te refieres?',
          candidates: collisions.map((record) => ({ id: record.id, title: record.title })),
        })
        return
      }
    }

    res.json(parsed)
  } catch (error) {
    res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
})

app.post('/api/ai/analyze', async (req, res) => {
  const payload = req.body?.metricsPayload
  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'Faltan las métricas calculadas del espacio.' })
    return
  }

  const messages: HistoryTurn[] = [
    {
      role: 'user',
      content: `Analiza el progreso de este espacio usando únicamente estas métricas ya calculadas:\n${JSON.stringify(payload)}`,
    },
  ]

  try {
    const analysis = await runValidated(ANALYZE_SYSTEM_PROMPT, messages, validateAnalysis)
    res.json(analysis)
  } catch (error) {
    res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Nexora AI server listening on http://127.0.0.1:${port}`)
})
