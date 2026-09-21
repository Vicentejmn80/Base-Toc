import type { FieldValue, Workspace } from '../domain/types'
import { toIsoDate } from './dates'
import { postAi } from './aiClient'
import { summarizeFields } from './captureDialogue'

export interface ImportRecord {
  source: string
  values: Record<string, FieldValue>
  review: boolean
  reason?: string
}

export interface ImportRequest {
  text: string
  workspace: Workspace
}

export function requestImport(input: ImportRequest, signal?: AbortSignal) {
  return postAi<{ records: ImportRecord[] }>(
    '/api/ai/import',
    {
      text: input.text,
      today: toIsoDate(),
      workspace: {
        name: input.workspace.name,
        kind: input.workspace.kind,
        fields: summarizeFields(input.workspace.fields),
      },
    },
    signal,
  )
}

function fold(value: string) {
  return value.trim().toLowerCase()
}

export function alignImportRecords(entries: string[], records: ImportRecord[]): ImportRecord[] {
  if (records.length >= entries.length) return records
  const missing = entries.filter((entry) => {
    const needle = fold(entry)
    if (!needle) return false
    return !records.some((record) => {
      const source = fold(record.source)
      if (!source) return false
      return source === needle || source.includes(needle) || needle.includes(source)
    })
  })
  return [
    ...records,
    ...missing.map((source) => ({
      source,
      values: {} as Record<string, FieldValue>,
      review: true,
      reason: 'No se pudo extraer con confianza',
    })),
  ]
}
