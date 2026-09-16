import type { Field, FieldValue, RecordItem, Workspace } from '../domain/types'
import { toIsoDate } from './dates'
import { postAi } from './aiClient'
import { recordTitle } from './records'
import { readSchema } from './schema'

export type CaptureKind =
  | 'new_record'
  | 'update_record'
  | 'needs_disambiguation'
  | 'needs_clarification'

export interface CaptureCandidate {
  id: string
  title: string
}

export type CaptureResult =
  | { kind: 'new_record'; values: Record<string, FieldValue> }
  | { kind: 'update_record'; recordId: string; values: Record<string, FieldValue> }
  | { kind: 'needs_disambiguation'; question: string; candidates: CaptureCandidate[] }
  | { kind: 'needs_clarification'; question: string }

export interface CaptureRequest {
  message: string
  workspace: Workspace
  history?: { role: 'user' | 'assistant'; content: string }[]
  selectedRecordId?: string
  previousProposal?: {
    kind: 'new_record' | 'update_record'
    recordId?: string
    values: Record<string, FieldValue>
  }
}

export function summarizeRecords(workspace: Workspace) {
  const schema = readSchema(workspace)
  return workspace.records.map((record) => ({
    id: record.id,
    title: recordTitle(record, 'Registro', workspace),
    status: schema.status ? String(record.values[schema.status.key] ?? '') : undefined,
  }))
}

export function summarizeFields(fields: Field[]) {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    role: field.role,
    unit: field.unit,
    options: field.options,
  }))
}

export function requestCapture(input: CaptureRequest, signal?: AbortSignal) {
  return postAi<CaptureResult>(
    '/api/ai/capture',
    {
      message: input.message,
      today: toIsoDate(),
      selectedRecordId: input.selectedRecordId,
      previousProposal: input.previousProposal,
      history: input.history ?? [],
      workspace: {
        id: input.workspace.id,
        name: input.workspace.name,
        kind: input.workspace.kind,
        fields: summarizeFields(input.workspace.fields),
        records: summarizeRecords(input.workspace),
      },
    },
    signal,
  )
}

export function mergeCaptureValues(
  workspace: Workspace,
  extracted: Record<string, FieldValue>,
  existing?: RecordItem,
): Record<string, FieldValue> {
  const base: Record<string, FieldValue> = {}
  for (const field of workspace.fields) {
    base[field.key] = existing?.values[field.key] ?? (field.type === 'boolean' ? false : null)
  }
  return { ...base, ...extracted }
}
