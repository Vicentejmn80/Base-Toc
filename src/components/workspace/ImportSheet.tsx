import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import type { Field, FieldValue, Workspace } from '../../domain/types'
import { AiRequestError } from '../../lib/aiClient'
import { mergeCaptureValues } from '../../lib/captureDialogue'
import { createId } from '../../lib/id'
import { alignImportRecords, requestImport, type ImportRecord } from '../../lib/importDialogue'
import { existingRecordById, findDuplicateMatch } from '../../lib/importMatch'
import { formatImportBatch, IMPORT_BATCH_SIZE, splitImportEntries } from '../../lib/importSplit'
import { useAppStore } from '../../state/store'
import { useToast } from '../../state/toast'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/cn'

interface ImportSheetProps {
  open: boolean
  workspace: Workspace
  onClose: () => void
  onImported?: (count: number) => void
}

interface ImportRow {
  id: string
  source: string
  values: Record<string, FieldValue>
  review: boolean
  reason?: string
  matchId?: string
  matchTitle?: string
  included: boolean
  mode: 'create' | 'update'
}

function toRows(records: ImportRecord[], workspace: Workspace): ImportRow[] {
  return records.map((record) => {
    const match = findDuplicateMatch(record.values, workspace)
    return {
      id: createId('imp'),
      source: record.source,
      values: { ...record.values },
      review: record.review,
      reason: record.reason,
      matchId: match?.id,
      matchTitle: match?.title,
      included: !match,
      mode: match ? 'update' : 'create',
    }
  })
}

export function ImportSheet({ open, workspace, onClose, onImported }: ImportSheetProps) {
  const { saveRecord } = useAppStore()
  const { showToast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const [step, setStep] = useState<'input' | 'running' | 'review'>('input')
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
    setStep('input')
    setRaw('')
    setFileName('')
    setRows([])
    setProgress(null)
    setError(null)
  }, [open])

  const counts = useMemo(() => {
    const nuevos = rows.filter((row) => !row.matchId).length
    const duplicados = rows.filter((row) => row.matchId).length
    const revisar = rows.filter((row) => row.review).length
    const included = rows.filter((row) => row.included).length
    return { nuevos, duplicados, revisar, included }
  }, [rows])

  function readFile(file: File) {
    const name = file.name.toLowerCase()
    const allowed =
      name.endsWith('.txt') ||
      name.endsWith('.csv') ||
      file.type.startsWith('text/') ||
      file.type === 'application/vnd.ms-excel'
    if (!allowed) {
      showToast('Usa un archivo .txt o .csv', 'danger')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setRaw(String(reader.result ?? ''))
      setFileName(file.name)
      setError(null)
    }
    reader.readAsText(file)
  }

  async function interpret() {
    const entries = splitImportEntries(raw)
    if (!entries.length) {
      showToast('No encontré entradas en ese texto.', 'danger')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setStep('running')
    setError(null)
    setProgress({ done: 0, total: entries.length })

    const collected: ImportRecord[] = []
    try {
      for (let index = 0; index < entries.length; index += IMPORT_BATCH_SIZE) {
        const batch = entries.slice(index, index + IMPORT_BATCH_SIZE)
        setProgress({ done: Math.min(index + batch.length, entries.length), total: entries.length })
        try {
          const result = await requestImport(
            { text: formatImportBatch(batch), workspace },
            controller.signal,
          )
          collected.push(...alignImportRecords(batch, result.records ?? []))
        } catch (batchError) {
          if (controller.signal.aborted) throw batchError
          collected.push(
            ...batch.map((source) => ({
              source,
              values: {} as Record<string, FieldValue>,
              review: true,
              reason: 'No se pudo interpretar este lote',
            })),
          )
        }
      }
      setRows(toRows(collected, workspace))
      setStep('review')
    } catch (caught) {
      if (controller.signal.aborted) return
      setStep('input')
      setError(caught instanceof AiRequestError ? caught.message : 'No se pudo interpretar el texto.')
    } finally {
      abortRef.current = null
    }
  }

  function patchRow(id: string, patch: Partial<ImportRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        if (patch.values) {
          const match = findDuplicateMatch(next.values, workspace)
          next.matchId = match?.id
          next.matchTitle = match?.title
          if (!match) next.mode = 'create'
        }
        return next
      }),
    )
  }

  function confirm() {
    const included = rows.filter((row) => row.included)
    if (!included.length) return
    for (const row of included) {
      const existing = row.mode === 'update' ? existingRecordById(workspace, row.matchId) : undefined
      saveRecord(workspace.id, mergeCaptureValues(workspace, row.values, existing), existing)
    }
    showToast(
      included.length === 1 ? 'Se importó 1 registro' : `Se importaron ${included.length} registros`,
      'success',
    )
    onImported?.(included.length)
    onClose()
  }

  const title =
    step === 'review' ? 'Revisar importación' : step === 'running' ? 'Importando' : 'Importar registros'
  const description =
    step === 'review'
      ? 'Nada se guarda hasta que confirmes. Puedes editar, excluir o tratar un duplicado como actualización.'
      : step === 'running'
        ? 'La IA está leyendo el texto por lotes. El progreso es real.'
        : 'Sube un .txt o .csv, o pega notas del teléfono. El formato no tiene que ser perfecto.'

  return (
    <Modal open={open} title={title} description={description} extraWide={step === 'review'} onClose={onClose}>
      {step === 'input' ? (
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-soft px-4 py-6 text-center">
            <Upload size={18} className="text-muted" />
            <span className="mt-2 text-sm font-medium">Subir archivo .txt o .csv</span>
            <span className="mt-1 text-xs text-muted">
              {fileName ? fileName : 'También puedes pegar el texto abajo'}
            </span>
            <input
              data-testid="import-file"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) readFile(file)
              }}
            />
          </label>
          <textarea
            data-testid="import-text"
            className="min-h-48 w-full rounded-2xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Pega aquí la lista: una entrada por línea, o bloques separados."
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value)
              setError(null)
            }}
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button data-testid="import-run" onClick={() => void interpret()} disabled={!raw.trim()}>
              Interpretar
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'running' && progress ? (
        <div className="space-y-3 py-6 text-center">
          <p data-testid="import-progress" className="text-base font-medium">
            Procesando {progress.done} de {progress.total}...
          </p>
          <p className="text-sm text-muted">Lotes de {IMPORT_BATCH_SIZE}. Nada se guarda todavía.</p>
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="space-y-4">
          <p data-testid="import-summary" className="text-sm font-medium">
            {counts.nuevos} nuevos, {counts.duplicados} posibles duplicados, {counts.revisar} para revisar
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 hover:bg-soft"
              onClick={() => setRows((current) => current.map((row) => ({ ...row, included: !row.matchId })))}
            >
              Solo nuevos
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 hover:bg-soft"
              onClick={() => setRows((current) => current.map((row) => ({ ...row, included: true })))}
            >
              Incluir todos
            </button>
          </div>
          <div className="max-h-[52dvh] space-y-3 overflow-auto pr-1">
            {rows.map((row, index) => (
              <ImportRowCard
                key={row.id}
                row={row}
                index={index}
                fields={workspace.fields}
                onPatch={patchRow}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button data-testid="import-confirm" onClick={confirm} disabled={!counts.included}>
              Importar {counts.included} {counts.included === 1 ? 'registro' : 'registros'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function ImportRowCard({
  row,
  index,
  fields,
  onPatch,
}: {
  row: ImportRow
  index: number
  fields: Field[]
  onPatch: (id: string, patch: Partial<ImportRow>) => void
}) {
  return (
    <article
      data-testid="import-row"
      data-dupe={row.matchId ? 'true' : 'false'}
      data-review={row.review ? 'true' : 'false'}
      className={cn(
        'rounded-2xl border p-3',
        row.matchId ? 'border-amber-200 bg-amber-50/70' : row.review ? 'border-orange-200 bg-orange-50/40' : 'border-line bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={row.included}
          aria-label={`Incluir entrada ${index + 1}`}
          onChange={(event) => onPatch(row.id, { included: event.target.checked })}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">#{index + 1}</span>
            {row.matchId ? (
              <span data-testid="import-dupe" className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Posible duplicado
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Nuevo</span>
            )}
            {row.review ? (
              <span data-testid="import-review" className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                Revisar
              </span>
            ) : null}
          </div>
          {row.matchId ? (
            <div className="space-y-2 rounded-xl bg-white/80 p-2 text-sm">
              <p>
                Parece el mismo que <span className="font-medium">{row.matchTitle}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${row.id}-mode`}
                    checked={row.mode === 'update'}
                    onChange={() => onPatch(row.id, { mode: 'update', included: true })}
                  />
                  Actualizar el existente
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${row.id}-mode`}
                    checked={row.mode === 'create'}
                    onChange={() => onPatch(row.id, { mode: 'create', included: true })}
                  />
                  Crear otro
                </label>
              </div>
            </div>
          ) : null}
          {row.reason ? <p className="text-xs text-muted">{row.reason}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
                  {field.label}
                </span>
                <ImportFieldInput
                  field={field}
                  value={row.values[field.key] ?? null}
                  onChange={(value) => onPatch(row.id, { values: { ...row.values, [field.key]: value } })}
                />
              </label>
            ))}
          </div>
          <p className="truncate text-[11px] text-muted" title={row.source}>
            Original: {row.source}
          </p>
        </div>
      </div>
    </article>
  )
}

function ImportFieldInput({
  field,
  value,
  onChange,
}: {
  field: Field
  value: FieldValue
  onChange: (value: FieldValue) => void
}) {
  const shared =
    'min-h-10 w-full rounded-xl border border-line bg-white px-2.5 py-2 text-sm outline-none focus:border-slate-400'

  if (field.type === 'longText') {
    return (
      <textarea
        className={`${shared} min-h-16`}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value || null)}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select className={shared} value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">—</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => onChange(value !== true)}
        className={cn(shared, 'text-left', value === true ? 'text-success' : 'text-muted')}
      >
        {value === true ? 'Sí' : 'No'}
      </button>
    )
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={shared}
        value={value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    )
  }

  return (
    <input
      type={field.type === 'date' ? 'date' : 'text'}
      className={shared}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value || null)}
    />
  )
}
