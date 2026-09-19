import { useEffect, useState } from 'react'
import type { Commitment, FieldValue, RecordItem, Workspace } from '../../domain/types'
import { AiRequestError } from '../../lib/aiClient'
import {
  captureConfirmLabel,
  captureHeadline,
  captureLoadingCopy,
  humanAiError,
  usePlainLanguage,
} from '../../lib/captureCopy'
import { mergeCaptureValues, requestCapture, type CaptureResult } from '../../lib/captureDialogue'
import {
  draftValuesFromCommitment,
  dueLabel,
  happenedMessage,
  isDueTodayOrOverdue,
  parseDueDate,
} from '../../lib/commitment'
import { useAppStore } from '../../state/store'
import { CapturePreview } from '../capture/CapturePreview'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function CommitmentsToday({ workspaces }: { workspaces: Workspace[] }) {
  const { commitments, saveRecord, patchCommitment } = useAppStore()
  const due = commitments.filter((item) => isDueTodayOrOverdue(item))
  if (!due.length) return null

  return (
    <section className="space-y-4" data-testid="commitments-today">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Compromisos de hoy</p>
      <div className="space-y-3">
        {due.map((commitment) => (
          <CommitmentCard
            key={commitment.id}
            commitment={commitment}
            workspaces={workspaces}
            onSaveRecord={saveRecord}
            onPatch={patchCommitment}
          />
        ))}
      </div>
    </section>
  )
}

function CommitmentCard({
  commitment,
  workspaces,
  onSaveRecord,
  onPatch,
}: {
  commitment: Commitment
  workspaces: Workspace[]
  onSaveRecord: (
    workspaceId: string,
    values: Record<string, FieldValue>,
    existing?: RecordItem,
  ) => RecordItem
  onPatch: (id: string, patch: Partial<Commitment>) => void
}) {
  const plain = usePlainLanguage()
  const [mode, setMode] = useState<'idle' | 'done' | 'no' | 'reschedule' | 'pick-space'>('idle')
  const [note, setNote] = useState<string | null>(null)
  const [fulfillWorkspaceId, setFulfillWorkspaceId] = useState(commitment.suggestedWorkspaceId)
  const fulfillWorkspace = workspaces.find((item) => item.id === fulfillWorkspaceId)

  if (note) {
    return (
      <div className="rounded-3xl border border-line bg-white px-4 py-3 text-[15px] leading-6 text-ink">
        {note}
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-4" data-testid="commitment-card">
      <p className="text-[15px] leading-6 text-ink">{commitment.description}</p>
      <p className="mt-1 text-sm text-muted">
        {dueLabel(commitment.dueDate)}
        {fulfillWorkspace ? ` · ${fulfillWorkspace.name}` : ''}
      </p>

      {mode === 'idle' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (fulfillWorkspaceId) {
                setMode('done')
                return
              }
              setMode('pick-space')
            }}
            data-testid="commitment-yes"
          >
            Sí, lo hice
          </Button>
          <Button variant="secondary" onClick={() => setMode('no')} data-testid="commitment-no">
            No
          </Button>
          <Button variant="ghost" onClick={() => setMode('reschedule')} data-testid="commitment-reschedule">
            Reprogramar
          </Button>
        </div>
      ) : null}

      {mode === 'no' ? (
        <div className="mt-3 space-y-3">
          <p className="text-[15px] leading-6 text-ink">
            Sin problema, ¿quieres reprogramarlo o lo dejamos así?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode('reschedule')}>
              Reprogramar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onPatch(commitment.id, { status: 'no_cumplido' })
                setNote('Listo, lo dejamos así.')
              }}
            >
              Dejarlo así
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'reschedule' ? (
        <RescheduleForm
          current={commitment.dueDate}
          onCancel={() => setMode('idle')}
          onSave={(dueDate) => {
            onPatch(commitment.id, { status: 'pendiente', dueDate })
            setNote(`Lo dejé para ${dueLabel(dueDate)}.`)
          }}
        />
      ) : null}

      {mode === 'pick-space' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-ink">¿En qué espacio lo anoto?</p>
          <div className="flex flex-wrap gap-2">
            {workspaces.map((workspace) => (
              <Button
                key={workspace.id}
                variant="secondary"
                onClick={() => {
                  setFulfillWorkspaceId(workspace.id)
                  onPatch(commitment.id, { suggestedWorkspaceId: workspace.id })
                  setMode('done')
                }}
              >
                {workspace.name}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setMode('idle')}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'done' && fulfillWorkspace ? (
        <FulfillModal
          commitment={commitment}
          workspace={fulfillWorkspace}
          plain={plain}
          onClose={() => setMode('idle')}
          onSaved={(recordId) => {
            onPatch(commitment.id, {
              status: 'cumplido',
              resultingRecordId: recordId,
              suggestedWorkspaceId: fulfillWorkspace.id,
            })
            setNote(plain ? 'Listo, lo anoté.' : 'Compromiso cumplido y registrado.')
          }}
          onSaveRecord={onSaveRecord}
        />
      ) : null}
    </div>
  )
}

function RescheduleForm({
  current,
  onSave,
  onCancel,
}: {
  current: string
  onSave: (dueDate: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(current)
  const [text, setText] = useState('')
  const parsed = parseDueDate(text) ?? (value || undefined)

  return (
    <div className="mt-3 space-y-3" data-testid="commitment-reschedule-form">
      <p className="text-sm text-ink">¿Para cuándo?</p>
      <input
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-slate-400"
      />
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="O dímelo: el viernes, la próxima semana…"
        className="min-h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-slate-400"
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={!parsed} onClick={() => parsed && onSave(parsed)}>
          Listo
        </Button>
      </div>
    </div>
  )
}

function FulfillModal({
  commitment,
  workspace,
  plain,
  onClose,
  onSaved,
  onSaveRecord,
}: {
  commitment: Commitment
  workspace?: Workspace
  plain: boolean
  onClose: () => void
  onSaved: (recordId: string) => void
  onSaveRecord: (
    workspaceId: string,
    values: Record<string, FieldValue>,
    existing?: RecordItem,
  ) => RecordItem
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Extract<CaptureResult, { kind: 'new_record' | 'update_record' }> | null>(
    null,
  )

  useEffect(() => {
    if (!workspace) return
    const draft: Extract<CaptureResult, { kind: 'new_record' }> = {
      kind: 'new_record',
      values: draftValuesFromCommitment(workspace, commitment.description),
    }
    const controller = new AbortController()
    void requestCapture(
      { message: happenedMessage(commitment.description), workspace },
      controller.signal,
    )
      .then((next) => {
        if (controller.signal.aborted) return
        if (next.kind === 'new_record' || next.kind === 'update_record') {
          setResult(next)
        } else {
          setResult(draft)
        }
        setStatus('ready')
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setResult(draft)
        setStatus('ready')
        setError(
          humanAiError(
            caught instanceof AiRequestError ? caught.message : 'Usé lo que ya sabía del compromiso.',
            plain,
          ),
        )
      })
    return () => controller.abort()
  }, [workspace, commitment.description, plain])

  if (!workspace || !result) {
    return (
      <Modal open title="Anotarlo" onClose={onClose}>
        <p className="text-sm text-muted">{status === 'loading' ? captureLoadingCopy(plain) : 'Falta un espacio para anotarlo.'}</p>
      </Modal>
    )
  }

  return (
    <Modal
      open
      wide
      title={captureHeadline(result.kind, workspace.name, undefined, plain)}
      description="Revisa que lo entendí bien antes de anotarlo."
      onClose={onClose}
    >
      <div className="space-y-4" data-testid="commitment-fulfill">
        {status === 'loading' ? <p className="text-sm text-muted">{captureLoadingCopy(plain)}</p> : null}
        {error && status === 'ready' ? <p className="text-xs text-muted">{error}</p> : null}
        <CapturePreview workspace={workspace} result={result} plain={plain} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const values = mergeCaptureValues(workspace, result.values)
              const record = onSaveRecord(workspace.id, values)
              onSaved(record.id)
            }}
            data-testid="commitment-fulfill-save"
          >
            {captureConfirmLabel(plain)}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
