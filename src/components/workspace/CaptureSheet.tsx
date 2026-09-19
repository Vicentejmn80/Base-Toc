import { useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import type { FieldValue, RecordItem, Workspace } from '../../domain/types'
import { FinanceConfirm } from '../finance/FinanceConfirm'
import { CommitmentConfirm } from '../capture/CommitmentConfirm'
import { ensureFinanceBook } from '../../finance/domain/book'
import {
  applyFinanceClarification,
  commitParsedEvents,
  interpretFinance,
  recordValuesFromEvent,
  type FinanceBrainResult,
  type ParsedFinanceEvent,
} from '../../finance'
import { useAppStore } from '../../state/store'
import {
  applyCommitmentClarification,
  interpretCommitment,
  leftoverAfterCommitments,
  materializeCommitment,
  type CommitmentParseResult,
  type ParsedCommitment,
} from '../../lib/commitment'
import { AiRequestError } from '../../lib/aiClient'
import {
  captureConfirmLabel,
  captureHeadline,
  captureLoadingCopy,
  humanAiError,
  usePlainLanguage,
} from '../../lib/captureCopy'
import {
  mergeCaptureValues,
  requestCapture,
  type CaptureResult,
} from '../../lib/captureDialogue'
import { recordTitle } from '../../lib/records'
import { PromptBox } from '../home/PromptBox'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../../state/toast'
import { captureExample } from '../../lib/schema'
import { CapturePreview } from '../capture/CapturePreview'
import { ReentryBanner } from '../capture/ReentryBanner'
import { SaveReward } from '../capture/SaveReward'
import { needsReentry } from '../../metrics/coverage'
import { buildSaveInsight } from '../../metrics/saveInsight'

interface CaptureSheetProps {
  open: boolean
  workspace: Workspace
  onClose: () => void
  onOpenForm: () => void
  onConfirm: (values: Record<string, FieldValue>, existing?: RecordItem) => void
}

type Status = 'idle' | 'loading' | 'error'
type HistoryTurn = { role: 'user' | 'assistant'; content: string }

function assistantLine(result: CaptureResult) {
  if (result.kind === 'needs_clarification' || result.kind === 'needs_disambiguation') {
    return result.question
  }
  if (result.kind === 'update_record') return `Propuesta de actualización sobre ${result.recordId}`
  return 'Propuesta de anotación'
}

export function CaptureSheet({ open, workspace, onClose, onOpenForm, onConfirm }: CaptureSheetProps) {
  const plain = usePlainLanguage()
  const { showToast } = useToast()
  const { saveFinance, saveRecord, saveCommitment, workspaces } = useAppStore()
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [financeResult, setFinanceResult] = useState<FinanceBrainResult | null>(null)
  const [commitmentDrafts, setCommitmentDrafts] = useState<ParsedCommitment[] | null>(null)
  const [commitmentParse, setCommitmentParse] = useState<CommitmentParseResult | null>(null)
  const financeSource = useRef('')
  const commitmentSource = useRef('')
  const [history, setHistory] = useState<HistoryTurn[]>([])
  const [correcting, setCorrecting] = useState(false)
  const [correction, setCorrection] = useState('')
  const [reward, setReward] = useState<string | null>(null)
  const lastAttempt = useRef<{
    message: string
    selectedRecordId?: string
    previousProposal?: {
      kind: 'new_record' | 'update_record'
      recordId?: string
      values: Record<string, FieldValue>
    }
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function reset() {
    abortRef.current?.abort()
    abortRef.current = null
    setPrompt('')
    setStatus('idle')
    setError(null)
    setResult(null)
    setHistory([])
    setCorrecting(false)
    setCorrection('')
    setReward(null)
    setFinanceResult(null)
    setCommitmentDrafts(null)
    setCommitmentParse(null)
    financeSource.current = ''
    commitmentSource.current = ''
    lastAttempt.current = null
  }

  function close() {
    reset()
    onClose()
  }

  async function submit(
    message: string,
    extras?: {
      selectedRecordId?: string
      previousProposal?: {
        kind: 'new_record' | 'update_record'
        recordId?: string
        values: Record<string, FieldValue>
      }
    },
  ) {
    const next = message.trim()
    if (!next) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    lastAttempt.current = { message: next, ...extras }

    setStatus('loading')
    setError(null)
    setCorrecting(false)
    setCorrection('')

    const parsedCommitment =
      commitmentParse?.kind === 'needs_clarification'
        ? applyCommitmentClarification(commitmentSource.current || next, next, workspaces, commitmentParse.partial)
        : interpretCommitment(next, workspaces)
    if (
      parsedCommitment.kind === 'needs_clarification' ||
      (parsedCommitment.kind === 'commitments' && leftoverAfterCommitments(next).length === 0)
    ) {
      commitmentSource.current = next
      setCommitmentParse(parsedCommitment)
      setCommitmentDrafts(parsedCommitment.kind === 'commitments' ? parsedCommitment.items : null)
      setFinanceResult(null)
      setResult(null)
      setPrompt('')
      setStatus(parsedCommitment.kind === 'needs_clarification' ? 'idle' : 'idle')
      setError(null)
      if (parsedCommitment.kind === 'needs_clarification') {
        setHistory((current) => [
          ...current,
          { role: 'user', content: next },
          { role: 'assistant', content: parsedCommitment.question },
        ])
      }
      return
    }

    if (workspace.kind === 'finance') {
      const book = ensureFinanceBook(workspace.finance)
      const interpreted =
        financeResult?.kind === 'needs_clarification'
          ? applyFinanceClarification(financeSource.current || next, next, book, financeResult.partial)
          : interpretFinance(next, book)
      financeSource.current = interpreted.kind === 'unparsed' ? next : interpreted.source
      setFinanceResult(interpreted)
      setHistory((current) => [
        ...current,
        { role: 'user', content: next },
        {
          role: 'assistant',
          content:
            interpreted.kind === 'needs_clarification'
              ? interpreted.question
              : interpreted.kind === 'events'
                ? 'Propuesta financiera'
                : 'No pude estructurar ese movimiento.',
        },
      ])
      setPrompt('')
      setStatus(interpreted.kind === 'unparsed' ? 'error' : 'idle')
      if (interpreted.kind === 'unparsed') {
        setError('Cuéntame qué pasó con el dinero: cantidad, y si puedes, moneda o cuenta.')
      }
      return
    }

    try {
      const nextResult = await requestCapture(
        {
          message: next,
          workspace,
          history,
          selectedRecordId: extras?.selectedRecordId,
          previousProposal: extras?.previousProposal,
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      if (nextResult.kind === 'new_commitment') {
        setCommitmentDrafts([
          {
            description: nextResult.description,
            dueDate: nextResult.dueDate,
            suggestedWorkspaceId: nextResult.suggestedWorkspaceId ?? workspace.id,
            source: next,
          },
        ])
        setResult(null)
      } else {
        setResult(nextResult)
      }
      setHistory((current) => [
        ...current,
        { role: 'user', content: next },
        { role: 'assistant', content: assistantLine(nextResult) },
      ])
      setPrompt('')
      setStatus('idle')
    } catch (caught) {
      if (controller.signal.aborted) return
      setStatus('error')
      setError(
        humanAiError(
          caught instanceof AiRequestError ? caught.message : 'No se pudo interpretar lo que pasó.',
          plain,
        ),
      )
    }
  }

  function confirmFinance(events: ParsedFinanceEvent[]) {
    const book = ensureFinanceBook(workspace.finance)
    const committed = commitParsedEvents(book, workspace.id, events)
    saveFinance(workspace.id, committed.book, `Se registraron ${committed.events.length} movimientos financieros.`)
    for (const event of committed.events) {
      saveRecord(workspace.id, recordValuesFromEvent(event))
    }
    setReward(
      committed.events.length > 1
        ? `Registré ${committed.events.length} movimientos.`
        : 'Listo, lo anoté en Finanzas.',
    )
    setFinanceResult(null)
    setPrompt('')
    setStatus('idle')
    setError(null)
  }

  function confirmCommitments() {
    if (!commitmentDrafts?.length) return
    for (const draft of commitmentDrafts) {
      const suggested = draft.suggestedWorkspaceId ?? workspace.id
      saveCommitment(materializeCommitment({ ...draft, suggestedWorkspaceId: suggested }))
    }
    setReward(commitmentDrafts.length > 1 ? 'Quedaron anotados.' : 'Listo, lo voy a tener presente.')
    setCommitmentDrafts(null)
    setCommitmentParse(null)
  }

  function confirm() {
    if (!result || (result.kind !== 'new_record' && result.kind !== 'update_record')) return
    const existing =
      result.kind === 'update_record'
        ? workspace.records.find((record) => record.id === result.recordId)
        : undefined
    if (result.kind === 'update_record' && !existing) {
      showToast(plain ? 'Eso ya no está en el espacio.' : 'Ese registro ya no está en el espacio.', 'danger')
      return
    }
    const values = mergeCaptureValues(workspace, result.values, existing)
    const insight = buildSaveInsight({ workspace, values, existing })
    onConfirm(values, existing)
    setReward(insight.text)
    setResult(null)
    setCorrecting(false)
    setCorrection('')
    setPrompt('')
    setStatus('idle')
    setError(null)
  }

  const existing =
    result?.kind === 'update_record'
      ? workspace.records.find((record) => record.id === result.recordId)
      : undefined

  const title = reward
    ? workspace.name
    : commitmentDrafts?.length
      ? 'Lo que va a pasar'
    : financeResult?.kind === 'events'
      ? 'Entendí esto'
    : result?.kind === 'new_record' || result?.kind === 'update_record'
      ? captureHeadline(
          result.kind,
          workspace.name,
          existing ? recordTitle(existing, 'esto', workspace) : undefined,
          plain,
        )
      : plain
        ? 'Contar qué pasó'
        : 'Contar qué pasó'

  return (
    <Modal
      open={open}
      wide
      title={title}
      description={
        reward
          ? undefined
          : plain
            ? 'Dímelo como quieras. Revisa que lo entendí bien antes de anotarlo.'
            : 'Cuéntame qué pasó. Confirma los campos antes de guardar.'
      }
      onClose={close}
    >
      <div className="space-y-4">
        {reward ? <SaveReward text={reward} onDone={close} /> : null}
        {!reward && needsReentry(workspace) &&
        result?.kind !== 'new_record' &&
        result?.kind !== 'update_record' ? (
          <ReentryBanner compact />
        ) : null}

        {commitmentParse?.kind === 'needs_clarification' ? (
          <div className="rounded-2xl border border-white/0 bg-violet-50 px-4 py-3" data-testid="commitment-clarification">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Una cosa más</p>
            <p className="mt-1.5 text-sm text-ink">{commitmentParse.question}</p>
          </div>
        ) : null}

        {commitmentDrafts?.length ? (
          <CommitmentConfirm
            description={commitmentDrafts[0].description}
            dueDate={commitmentDrafts[0].dueDate ?? ''}
            workspaceName={
              workspaces.find((item) => item.id === (commitmentDrafts[0].suggestedWorkspaceId ?? workspace.id))?.name
            }
            onConfirm={confirmCommitments}
            onEdit={() => {
              setCorrecting(true)
              setCorrection(commitmentSource.current)
            }}
          />
        ) : null}

        {financeResult?.kind === 'needs_clarification' ? (
          <div className="rounded-2xl border border-white/0 bg-violet-50 px-4 py-3" data-testid="finance-clarification">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Una cosa más</p>
            <p className="mt-1.5 text-sm text-ink">{financeResult.question}</p>
          </div>
        ) : null}

        {financeResult?.kind === 'events' ? (
          <FinanceConfirm
            events={financeResult.events}
            onConfirm={() => confirmFinance(financeResult.events)}
            onEdit={() => {
              setCorrecting(true)
              setCorrection(financeSource.current)
            }}
          />
        ) : null}

        {result?.kind === 'needs_clarification' ? (
          <div className="rounded-2xl border border-white/0 bg-violet-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
              {plain ? 'Una cosa más' : 'Necesito un dato más'}
            </p>
            <p className="mt-1.5 text-sm text-ink">{result.question}</p>
          </div>
        ) : null}

        {result?.kind === 'needs_disambiguation' ? (
          <div className="space-y-2">
            <p className="text-sm text-ink">{result.question}</p>
            <div className="grid gap-2">
              {result.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  data-testid="capture-candidate"
                  disabled={status === 'loading'}
                  onClick={() =>
                    void submit(`Me refiero a ${candidate.title}.`, {
                      selectedRecordId: candidate.id,
                    })
                  }
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm hover:border-slate-300"
                >
                  <span className="font-medium text-ink">{candidate.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {result?.kind === 'new_record' || result?.kind === 'update_record' ? (
          <CapturePreview workspace={workspace} result={result} existing={existing} plain={plain} />
        ) : null}

        {correcting ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium">¿Qué está mal o qué falta?</label>
            <textarea
              value={correction}
              onChange={(event) => setCorrection(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              placeholder="Ej. el canal fue correo, no WhatsApp"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCorrecting(false)}>
                Volver
              </Button>
              <Button
                disabled={!correction.trim() || status === 'loading'}
                onClick={() => {
                  if (!result || (result.kind !== 'new_record' && result.kind !== 'update_record')) {
                    return
                  }
                  void submit(correction, {
                    previousProposal: {
                      kind: result.kind,
                      recordId: result.kind === 'update_record' ? result.recordId : undefined,
                      values: result.values,
                    },
                  })
                }}
              >
                {plain ? 'Listo' : 'Enviar corrección'}
              </Button>
            </div>
          </div>
        ) : null}

        {status === 'loading' ? (
          <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
            <p className="text-sm text-muted">{captureLoadingCopy(plain)}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-soft">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#93c5fd,#818cf8,#c084fc)]" />
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            <p>{error}</p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => {
                const attempt = lastAttempt.current
                if (!attempt) return
                void submit(attempt.message, {
                  selectedRecordId: attempt.selectedRecordId,
                  previousProposal: attempt.previousProposal,
                })
              }}
            >
              {plain ? 'Intentarlo de nuevo' : 'Reintentar'}
            </Button>
          </div>
        ) : null}

        {!reward &&
        !correcting &&
        financeResult?.kind !== 'events' &&
        !commitmentDrafts?.length &&
        result?.kind !== 'new_record' &&
        result?.kind !== 'update_record' &&
        result?.kind !== 'needs_disambiguation' ? (
          <PromptBox
            compact
            inputId="nexora-prompt-capture"
            value={prompt}
            busy={status === 'loading'}
            voiceScope={workspace.kind}
            placeholder={captureExample(workspace)}
            onChange={setPrompt}
            onSubmit={() => void submit(prompt)}
            onVoiceTranscript={(text) => {
              setPrompt(text)
              void submit(text)
            }}
            onSoon={(message) => showToast(message)}
          />
        ) : null}

        {!correcting && result?.kind === 'needs_disambiguation' ? (
          <p className="text-xs text-muted">
            {plain ? 'Elige uno para seguir. Todavía no anoto nada.' : 'Elige un registro para continuar. No se guarda nada todavía.'}
          </p>
        ) : null}

        {!reward ? (
          <button
            type="button"
            className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              close()
              onOpenForm()
            }}
          >
            {plain ? 'Prefiero llenarlo yo' : 'Llenar formulario manualmente'}
          </button>
        ) : null}
      </div>

      {!reward && (result?.kind === 'new_record' || result?.kind === 'update_record') ? (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => setCorrecting(true)} disabled={status === 'loading'}>
            Corregir
          </Button>
          <Button onClick={confirm} disabled={status === 'loading'}>
            {captureConfirmLabel(plain)}
          </Button>
        </div>
      ) : null}
    </Modal>
  )
}

export function CaptureLauncher({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} className="min-h-11">
      <MessageCircle size={16} />
      <span className="sm:hidden">Contar</span>
      <span className="hidden sm:inline">Contar qué pasó</span>
    </Button>
  )
}
