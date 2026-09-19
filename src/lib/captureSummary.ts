import type { CaptureResult } from './captureDialogue'
import { formatAmount, formatNumber } from './format'
import { readSchema } from './schema'
import type { FieldValue, Workspace } from '../domain/types'

function numberFrom(values: Record<string, FieldValue>, key?: string) {
  if (!key) return 0
  const raw = values[key]
  return typeof raw === 'number' ? raw : Number(raw) || 0
}

export function captureIntentLine(
  workspaceName: string,
  workspace: Workspace | undefined,
  capture: CaptureResult,
) {
  if (capture.kind === 'new_commitment') {
    return capture.description
  }
  if (capture.kind !== 'new_record' && capture.kind !== 'update_record') {
    return workspaceName
  }
  if (!workspace) return `${workspaceName} · anotación`

  const schema = readSchema(workspace)
  if (schema.amount) {
    const amount = numberFrom(capture.values, schema.amount.key)
    if (amount) {
      const sign = amount >= 0 ? '+' : ''
      return `${workspaceName} · ${sign}${formatAmount(amount, schema.amount.unit)}`
    }
  }

  const countField = workspace.fields.find(
    (field) => field.type === 'number' && field.key !== schema.amount?.key,
  )
  const count = countField ? numberFrom(capture.values, countField.key) : 0
  const noun = schema.identifier?.label.toLowerCase() ?? (workspace.kind === 'crm' ? 'contactos' : 'registro')
  const qty = count > 0 ? count : 1
  return `${workspaceName} · +${formatNumber(qty)} ${qty === 1 ? noun.replace(/s$/, '') : noun}`
}
