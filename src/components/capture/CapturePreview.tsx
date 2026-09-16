import type { Field, FieldValue, RecordItem, Workspace } from '../../domain/types'
import type { CaptureResult } from '../../lib/captureDialogue'
import { formatDate } from '../../lib/dates'

export function formatCaptureValue(field: Field, value: FieldValue) {
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'boolean') return value ? 'Sí' : 'No'
  if (field.type === 'date') return formatDate(value)
  return String(value)
}

export function CapturePreview({
  workspace,
  result,
  existing,
  plain = false,
}: {
  workspace: Workspace
  result: Extract<CaptureResult, { kind: 'new_record' | 'update_record' }>
  existing?: RecordItem
  plain?: boolean
}) {
  const keys = Object.keys(result.values)
  const fields = workspace.fields.filter((field) => keys.includes(field.key))

  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <p className="ai-label text-xs font-semibold uppercase tracking-[0.12em]">
        {result.kind === 'update_record'
          ? plain
            ? 'Esto es lo que cambiaría'
            : 'Cambios propuestos'
          : plain
            ? 'Esto es lo que entendí'
            : 'Campos extraídos'}
      </p>
      <dl className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {fields.map((field) => {
          const next = result.values[field.key]
          const previous = existing?.values[field.key]
          const changed =
            result.kind === 'update_record' && String(previous ?? '') !== String(next ?? '')
          return (
            <div key={field.key} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
              <dt className="text-muted">{field.label}</dt>
              <dd className="text-right">
                {changed ? (
                  <span className="block">
                    <span className="text-slate-400 line-through">{formatCaptureValue(field, previous ?? null)}</span>
                    <span className="mt-0.5 block font-medium text-violet-700">
                      {formatCaptureValue(field, next)}
                    </span>
                  </span>
                ) : (
                  <span className="text-ink">{formatCaptureValue(field, next)}</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
