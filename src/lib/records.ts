import type { RecordItem, Workspace } from '../domain/types'
import { fieldByRole, readSchema } from './schema'

export function recordTitle(
  record: RecordItem | null | undefined,
  fallback = 'este registro',
  workspace?: Workspace,
) {
  if (!record) return fallback
  const values = record.values
  if (workspace) {
    const identifier = fieldByRole(workspace, 'identifier')
    const named = identifier ? values[identifier.key] : undefined
    if (named !== null && named !== undefined && String(named).trim()) return String(named)
  }
  const named = values.colegio ?? values.nombre ?? values.descripcion ?? values.habito
  if (named !== null && named !== undefined && String(named).trim()) return String(named)
  const schemaDate = workspace ? readSchema(workspace).date : undefined
  if (schemaDate && values[schemaDate.key]) return `registro del ${String(values[schemaDate.key])}`
  if (values.fecha) return `registro del ${String(values.fecha)}`
  return fallback
}
