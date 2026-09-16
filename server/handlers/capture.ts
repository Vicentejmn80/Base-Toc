import { CAPTURE_SYSTEM_PROMPT } from '../prompts.ts'
import {
  validateCapture,
  type CaptureFieldDef,
  type CaptureRecordSummary,
} from '../validate.ts'
import {
  captureTokenHits,
  HttpError,
  isHistoryTurn,
  normalizeName,
  runValidated,
  type HistoryTurn,
} from './shared.ts'

export async function handleCapture(body: unknown) {
  const payload = body as Record<string, unknown>
  const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
  if (!message) {
    throw new HttpError(400, 'Cuéntame qué pasó para poder interpretarlo.')
  }

  const workspace = payload?.workspace
  if (!workspace || typeof workspace !== 'object') {
    throw new HttpError(400, 'Falta el contexto del espacio.')
  }

  const ws = workspace as Record<string, unknown>
  const fields: CaptureFieldDef[] = Array.isArray(ws.fields)
    ? ws.fields
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

  const records: CaptureRecordSummary[] = Array.isArray(ws.records)
    ? ws.records
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

  const history = Array.isArray(payload?.history)
    ? payload.history.filter((item: unknown): item is HistoryTurn => isHistoryTurn(item)).slice(-8)
    : []

  const selectedRecordId =
    typeof payload?.selectedRecordId === 'string' ? payload.selectedRecordId : undefined
  const today =
    typeof payload?.today === 'string' ? payload.today : new Date().toISOString().slice(0, 10)

  const system = `${CAPTURE_SYSTEM_PROMPT}

Fecha de hoy: ${today}.
Espacio: ${typeof ws.name === 'string' ? ws.name : 'sin nombre'} (${typeof ws.kind === 'string' ? ws.kind : 'custom'}).
Campos:
${fields.map((field) => `- ${field.key} (${field.label}, type ${field.type}${field.role ? `, role ${field.role}` : ''}${field.unit ? `, unit ${field.unit}` : ''}${field.options?.length ? `; opciones EXACTAS: ${field.options.map((option) => option.value).join(' | ')}` : ''})`).join('\n')}

Registros existentes (id · título · estado):
${records.length ? records.map((record) => `- ${record.id} · ${record.title}${record.status ? ` · ${record.status}` : ''}`).join('\n') : '- ninguno'}

${selectedRecordId ? `El usuario ya eligió el registro ${selectedRecordId}. Debes devolver update_record con ese recordId.` : ''}
${payload?.previousProposal ? `Propuesta anterior a corregir: ${JSON.stringify(payload.previousProposal)}` : ''}
`

  const messages: HistoryTurn[] = [...history, { role: 'user', content: message }]

  const parsed = await runValidated(system, messages, (value) => validateCapture(value, fields, records))

  const previousProposal = payload?.previousProposal as
    | { kind?: string; values?: Record<string, unknown> }
    | undefined
  if (
    previousProposal &&
    previousProposal.kind === 'new_record' &&
    parsed.kind === 'update_record' &&
    !selectedRecordId
  ) {
    return {
      kind: 'new_record',
      values: {
        ...(typeof previousProposal.values === 'object' && previousProposal.values
          ? previousProposal.values
          : {}),
        ...parsed.values,
      },
    }
  }

  if (selectedRecordId && records.some((record) => record.id === selectedRecordId)) {
    if (parsed.kind === 'new_record') {
      return {
        kind: 'update_record',
        recordId: selectedRecordId,
        values: parsed.values,
      }
    }
    if (parsed.kind === 'update_record') {
      return { ...parsed, recordId: selectedRecordId }
    }
  }

  if (!selectedRecordId && parsed.kind === 'update_record') {
    const collisions = captureTokenHits(message, records)
    const chosen = records.find((record) => record.id === parsed.recordId)
    const uniqueMention = chosen ? normalizeName(message).includes(normalizeName(chosen.title)) : false
    if (collisions.length >= 2 && !uniqueMention) {
      return {
        kind: 'needs_disambiguation',
        question: 'Hay más de un registro que coincide. ¿A cuál te refieres?',
        candidates: collisions.map((record) => ({ id: record.id, title: record.title })),
      }
    }
  }

  return parsed
}
