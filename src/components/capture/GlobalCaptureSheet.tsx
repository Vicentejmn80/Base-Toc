import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FieldValue, RecordItem, Workspace, WorkspaceProposal } from '../../domain/types'
import { AiRequestError } from '../../lib/aiClient'
import {
  captureConfirmLabel,
  captureHeadline,
  captureLoadingCopy,
  humanAiError,
  usePlainLanguage,
} from '../../lib/captureCopy'
import { mergeCaptureValues, type CaptureResult } from '../../lib/captureDialogue'
import {
  continueCreationDialogue,
  emptyDialogueState,
  startCreationDialogue,
  type CreationDialogueState,
} from '../../lib/creationDialogue'
import {
  assistantLineForCapture,
  continueIntentCapture,
  requestGlobalCapture,
  type GlobalCaptureResult,
} from '../../lib/globalCapture'
import { recordTitle } from '../../lib/records'
import { CommitmentConfirm } from './CommitmentConfirm'
import { FinanceConfirm } from '../finance/FinanceConfirm'
import { FinanceOnboarding } from '../finance/FinanceOnboarding'
import { ensureFinanceBook } from '../../finance/domain/book'
import {
  applyFinanceClarification,
  commitParsedEvents,
  extractFinanceSlices,
  interpretFinance,
  isFinanceOnlyUtterance,
  recordValuesFromEvent,
  type FinanceBrainResult,
} from '../../finance'
import {
  applyCommitmentClarification,
  interpretCommitment,
  leftoverAfterCommitments,
  materializeCommitment,
  type CommitmentParseResult,
  type ParsedCommitment,
} from '../../lib/commitment'
import { useAppStore } from '../../state/store'
import { useToast } from '../../state/toast'
import { CreationFlow, type CreationStatus } from '../creation/CreationFlow'
import { PromptBox } from '../home/PromptBox'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { CapturePreview } from './CapturePreview'
import { AiWorkingState } from './AiWorkingState'
import { SaveReward } from './SaveReward'
import { buildConsolidatedSaveInsight, buildSaveInsight } from '../../metrics/saveInsight'
import { captureIntentLine } from '../../lib/captureSummary'

type Status = 'idle' | 'loading' | 'error'
type HistoryTurn = { role: 'user' | 'assistant'; content: string }

interface IntentState {
  id: string
  workspaceId: string
  workspaceName: string
  capture: CaptureResult
  status: 'pending' | 'saved' | 'dismissed'
  insight?: string
}

interface GlobalCaptureSheetProps {
  open: boolean
  seed?: string
  onClose: () => void
}

export function GlobalCaptureSheet({ open, seed, onClose }: GlobalCaptureSheetProps) {
  const plain = usePlainLanguage()
  const navigate = useNavigate()
  const { workspaces, saveRecord, saveFinance, saveCommitment } = useAppStore()
  const { showToast } = useToast()
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryTurn[]>([])
  const [intents, setIntents] = useState<IntentState[]>([])
  const [createSpace, setCreateSpace] = useState<{ seed: string } | null>(null)
  const [globalQuestion, setGlobalQuestion] = useState<string | null>(null)
  const [busyIntentId, setBusyIntentId] = useState<string | null>(null)
  const [proposal, setProposal] = useState<WorkspaceProposal | null>(null)
  const [creationStatus, setCreationStatus] = useState<CreationStatus>('idle')
  const [creationError, setCreationError] = useState<string | null>(null)
  const [dialogueState, setDialogueState] = useState<CreationDialogueState>(emptyDialogueState)
  const [heard, setHeard] = useState<string | null>(null)
  const [batchReward, setBatchReward] = useState<string | null>(null)
  const [correctingBatch, setCorrectingBatch] = useState(false)
  const [financeResult, setFinanceResult] = useState<FinanceBrainResult | null>(null)
  const [financeWorkspaceId, setFinanceWorkspaceId] = useState<string | null>(null)
  const [commitmentDrafts, setCommitmentDrafts] = useState<ParsedCommitment[] | null>(null)
  const [commitmentParse, setCommitmentParse] = useState<CommitmentParseResult | null>(null)
  const financeSource = useRef('')
  const commitmentSource = useRef('')
  const lastAttempt = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function reset() {
    abortRef.current?.abort()
    abortRef.current = null
    setPrompt('')
    setStatus('idle')
    setError(null)
    setHistory([])
    setIntents([])
    setCreateSpace(null)
    setGlobalQuestion(null)
    setBusyIntentId(null)
    setProposal(null)
    setCreationStatus('idle')
    setCreationError(null)
    setDialogueState(emptyDialogueState())
    setHeard(null)
    setBatchReward(null)
    setCorrectingBatch(false)
    setFinanceResult(null)
    setFinanceWorkspaceId(null)
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

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    const initial = seed?.trim()
    if (initial) void submitGlobal(initial)
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submitGlobal(message: string) {
    const next = message.trim()
    if (!next) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    lastAttempt.current = next
    setHeard(next)
    setStatus('loading')
    setError(null)
    setGlobalQuestion(null)

    const clarifyingCommitment = commitmentParse?.kind === 'needs_clarification'
    const parsedCommitment = clarifyingCommitment
      ? applyCommitmentClarification(commitmentSource.current || next, next, workspaces, commitmentParse.partial)
      : interpretCommitment(next, workspaces)
    const leftover = clarifyingCommitment ? leftoverAfterCommitments(commitmentSource.current || next) : leftoverAfterCommitments(next)

    if (parsedCommitment.kind === 'needs_clarification' && (!leftover || clarifyingCommitment)) {
      commitmentSource.current = parsedCommitment.partial?.map((item) => item.source).join('. ') || next
      setCommitmentParse(parsedCommitment)
      setCommitmentDrafts(null)
      setFinanceResult(null)
      setPrompt('')
      setStatus('idle')
      setGlobalQuestion(parsedCommitment.question)
      return
    }

    if (parsedCommitment.kind === 'commitments') {
      commitmentSource.current = next
      setCommitmentParse(parsedCommitment)
      setCommitmentDrafts(parsedCommitment.items)
      setGlobalQuestion(null)
      if (!leftover) {
        setFinanceResult(null)
        setIntents([])
        setCreateSpace(null)
        setPrompt('')
        setStatus('idle')
        return
      }
    } else {
      setCommitmentDrafts(null)
      setCommitmentParse(null)
    }

    const captureMessage = parsedCommitment.kind === 'commitments' && leftover ? leftover : next

    const financeWorkspace = workspaces.find((item) => item.kind === 'finance')
    const financeFollowUp = financeResult?.kind === 'needs_clarification'
    if (financeWorkspace && (financeFollowUp || isFinanceOnlyUtterance(captureMessage))) {
      const book = ensureFinanceBook(financeWorkspace.finance)
      if (!book.setup.complete) {
        setFinanceWorkspaceId(financeWorkspace.id)
        setFinanceResult(null)
        setPrompt('')
        setStatus('idle')
        return
      }
      const interpreted =
        financeResult?.kind === 'needs_clarification'
          ? applyFinanceClarification(financeSource.current || captureMessage, captureMessage, book, financeResult.partial)
          : interpretFinance(captureMessage, book)
      financeSource.current = interpreted.source
      setFinanceWorkspaceId(financeWorkspace.id)
      setFinanceResult(interpreted.kind === 'unparsed' ? null : interpreted)
      setIntents([])
      setCreateSpace(null)
      setPrompt('')
      setStatus(interpreted.kind === 'unparsed' ? 'error' : 'idle')
      if (interpreted.kind === 'unparsed') {
        setError('Cuéntame qué pasó con el dinero: cantidad, y si puedes, moneda o cuenta.')
      }
      if (interpreted.kind === 'needs_clarification') setGlobalQuestion(interpreted.question)
      else if (!commitmentDrafts) setGlobalQuestion(null)
      return
    }

    try {
      const result = await requestGlobalCapture(
        { message: captureMessage, workspaces, history },
        controller.signal,
      )
      if (controller.signal.aborted) return
      applyGlobalResult(next, result)
      setPrompt('')
      setStatus('idle')
    } catch (caught) {
      if (controller.signal.aborted) return
      setStatus('error')
      setError(
        humanAiError(
          caught instanceof AiRequestError ? caught.message : 'No pude entender lo que pasó.',
          plain,
        ),
      )
    }
  }

  function applyGlobalResult(message: string, result: GlobalCaptureResult) {
    setCorrectingBatch(false)
    if (result.kind === 'needs_clarification') {
      setGlobalQuestion(result.question)
      setIntents([])
      setCreateSpace(null)
      setHistory((current) => [
        ...current,
        { role: 'user', content: message },
        { role: 'assistant', content: result.question },
      ])
      return
    }
    if (result.kind === 'create_space') {
      setIntents([])
      setCreateSpace({ seed: result.seed || message })
      setGlobalQuestion(null)
      setHistory((current) => [
        ...current,
        { role: 'user', content: message },
        { role: 'assistant', content: 'Esto no encaja en lo que ya mides.' },
      ])
      return
    }
    setIntents(
      result.intents.map((intent) => ({
        ...intent,
        status: 'pending' as const,
      })),
    )
    setCreateSpace(result.createSpace ?? null)
    setGlobalQuestion(null)
    if (result.commitments?.length) {
      setCommitmentDrafts((current) => {
        const incoming = result.commitments ?? []
        const existing = current ?? []
        const merged = [...existing]
        for (const item of incoming) {
          if (!merged.some((draft) => draft.description === item.description && draft.dueDate === item.dueDate)) {
            merged.push({ ...item, source: message })
          }
        }
        return merged
      })
    }
    setHistory((current) => [
      ...current,
      { role: 'user', content: message },
      {
        role: 'assistant',
        content: result.intents.map((intent) => assistantLineForCapture(intent.capture, intent.workspaceName)).join(' · '),
      },
    ])
  }

  async function patchIntent(
    intent: IntentState,
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
    const workspace = workspaces.find((item) => item.id === intent.workspaceId)
    if (!workspace) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusyIntentId(intent.id)
    setError(null)
    try {
      const capture = await continueIntentCapture(
        {
          message,
          workspace,
          selectedRecordId: extras?.selectedRecordId,
          previousProposal: extras?.previousProposal,
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      setIntents((current) =>
        current.map((item) => (item.id === intent.id ? { ...item, capture, status: 'pending' } : item)),
      )
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(
        humanAiError(
          caught instanceof AiRequestError ? caught.message : 'No pude actualizar esa anotación.',
          plain,
        ),
      )
    } finally {
      if (!controller.signal.aborted) setBusyIntentId(null)
    }
  }

  function persistFinanceIfPossible(
    workspace: Workspace,
    fallbackValues: Record<string, FieldValue>,
    existing?: RecordItem,
  ) {
    if (workspace.kind !== 'finance') {
      saveRecord(workspace.id, fallbackValues, existing)
      return
    }
    const book = ensureFinanceBook(workspace.finance)
    const source = financeSource.current || lastAttempt.current || heard || ''
    const slice = extractFinanceSlices(source).join('. ')
    if (book.setup.complete && slice) {
      const interpreted = interpretFinance(slice, book)
      if (interpreted.kind === 'events') {
        const committed = commitParsedEvents(book, workspace.id, interpreted.events)
        saveFinance(
          workspace.id,
          committed.book,
          `Se registraron ${committed.events.length} movimientos financieros.`,
        )
        for (const event of committed.events) {
          saveRecord(workspace.id, recordValuesFromEvent(event))
        }
        return
      }
    }
    saveRecord(workspace.id, fallbackValues, existing)
  }

  function confirmCommitments() {
    if (!commitmentDrafts?.length) return
    for (const draft of commitmentDrafts) {
      saveCommitment(materializeCommitment(draft))
    }
    setBatchReward(
      commitmentDrafts.length > 1
        ? `Quedaron ${commitmentDrafts.length} compromisos.`
        : 'Listo, lo voy a tener presente.',
    )
    setCommitmentDrafts(null)
    setCommitmentParse(null)
  }

  function confirmIntent(intent: IntentState) {
    const capture = intent.capture
    if (capture.kind !== 'new_record' && capture.kind !== 'update_record') return
    const workspace = workspaces.find((item) => item.id === intent.workspaceId)
    if (!workspace) {
      showToast(plain ? 'Ese espacio ya no está.' : 'El espacio ya no existe.', 'danger')
      return
    }
    const existing =
      capture.kind === 'update_record'
        ? workspace.records.find((record) => record.id === capture.recordId)
        : undefined
    if (capture.kind === 'update_record' && !existing) {
      showToast(plain ? 'Eso ya no está en el espacio.' : 'Ese registro ya no está en el espacio.', 'danger')
      return
    }
    const values = mergeCaptureValues(workspace, capture.values, existing)
    const insight = buildSaveInsight({ workspace, values, existing })
    persistFinanceIfPossible(workspace, values, existing)
    setIntents((current) =>
      current.map((item) =>
        item.id === intent.id ? { ...item, status: 'saved', insight: insight.text } : item,
      ),
    )
  }

  function confirmAll() {
    const ready = intents.filter(
      (intent) =>
        intent.status === 'pending' &&
        (intent.capture.kind === 'new_record' || intent.capture.kind === 'update_record'),
    )
    let currentSpaces = workspaces
    const insights = ready.map((intent) => {
      const capture = intent.capture
      const workspace = currentSpaces.find((item) => item.id === intent.workspaceId)
      if (!workspace || (capture.kind !== 'new_record' && capture.kind !== 'update_record')) {
        return { intent, insight: null as ReturnType<typeof buildSaveInsight> | null }
      }
      const existing =
        capture.kind === 'update_record'
          ? workspace.records.find((record) => record.id === capture.recordId)
          : undefined
      const values = mergeCaptureValues(workspace, capture.values, existing)
      const insight = buildSaveInsight({ workspace, values, existing })
      persistFinanceIfPossible(workspace, values, existing)
      const incoming = {
        id: existing?.id ?? `__pending_${intent.id}`,
        workspaceId: workspace.id,
        values,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      currentSpaces = currentSpaces.map((item) =>
        item.id !== workspace.id
          ? item
          : {
              ...item,
              records: existing
                ? item.records.map((record) => (record.id === existing.id ? incoming : record))
                : [...item.records, incoming],
            },
      )
      return { intent, insight }
    })
    setIntents((current) =>
      current.map((item) => {
        const match = insights.find((entry) => entry.intent.id === item.id)
        return match?.insight
          ? { ...item, status: 'saved' as const, insight: match.insight.text }
          : item
      }),
    )
    const built = insights
      .map((entry) => entry.insight)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    if (built.length) setBatchReward(buildConsolidatedSaveInsight(built).text)
  }

  async function startCreateSpace(seedText: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setCreationStatus('loading')
    setCreationError(null)
    setProposal(null)
    try {
      const result =
        dialogueState.stage === 'awaiting_clarification'
          ? await continueCreationDialogue(dialogueState, seedText, workspaces, controller.signal)
          : await startCreationDialogue(seedText, workspaces, controller.signal)
      if (controller.signal.aborted) return
      if (result.kind === 'ask') {
        setDialogueState(result.state)
        setGlobalQuestion(result.question.text)
        setCreateSpace(null)
        setCreationStatus('idle')
        return
      }
      setDialogueState(result.state)
      setProposal(result.proposal)
      setCreationStatus('ready')
      setGlobalQuestion(null)
    } catch (caught) {
      if (controller.signal.aborted) return
      setCreationStatus('error')
      setCreationError(
        humanAiError(
          caught instanceof AiRequestError ? caught.message : 'No pude armar el espacio.',
          plain,
        ),
      )
    }
  }

  const pendingIntents = intents.filter((intent) => intent.status === 'pending')
  const hasConfirmable = pendingIntents.some(
    (intent) => intent.capture.kind === 'new_record' || intent.capture.kind === 'update_record',
  )
  const hasIntentFollowup = pendingIntents.some(
    (intent) =>
      intent.capture.kind === 'needs_clarification' || intent.capture.kind === 'needs_disambiguation',
  )
  const financeWorkspace = workspaces.find((item) => item.id === financeWorkspaceId)
  const financeNeedsSetup = Boolean(financeWorkspace && !ensureFinanceBook(financeWorkspace.finance).setup.complete)
  const showPrompt =
    status !== 'loading' &&
    creationStatus !== 'loading' &&
    !busyIntentId &&
    !batchReward &&
    !financeNeedsSetup &&
    financeResult?.kind !== 'events' &&
    !commitmentDrafts?.length &&
    (Boolean(globalQuestion) || correctingBatch || (!hasConfirmable && !hasIntentFollowup))

  const confirmable = pendingIntents.filter(
    (intent) => intent.capture.kind === 'new_record' || intent.capture.kind === 'update_record',
  )
  const title = plain ? 'Contar' : 'Qué pasó'
  const description = plain
    ? 'Graba una nota o escríbela. Yo te digo a dónde iría cada cosa.'
    : 'Cuéntame el día. Confirma cada anotación antes de guardar.'

  return (
    <>
      <Modal open={open} wide title={title} description={description} onClose={close}>
        <div className="space-y-4" data-testid="global-capture-sheet">
          {batchReward ? <SaveReward text={batchReward} /> : null}

          {heard ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {plain ? 'Esto es lo que te escuché' : 'Transcripción'}
              </p>
              <p className="mt-1.5 text-[15px] leading-6 text-ink">“{heard}”</p>
            </div>
          ) : null}

          {commitmentDrafts?.length ? (
            <div className="space-y-4">
              {commitmentDrafts.map((draft, index) => (
                <CommitmentConfirm
                  key={`${draft.description}-${draft.dueDate}-${index}`}
                  description={draft.description}
                  dueDate={draft.dueDate ?? ''}
                  workspaceName={workspaces.find((item) => item.id === draft.suggestedWorkspaceId)?.name}
                  onConfirm={confirmCommitments}
                  onEdit={() => {
                    setCorrectingBatch(true)
                    setPrompt(commitmentSource.current)
                    setCommitmentDrafts(null)
                  }}
                />
              ))}
            </div>
          ) : null}

          {financeNeedsSetup && financeWorkspace ? (
            <FinanceOnboarding
              book={financeWorkspace.finance}
              onComplete={(book) => {
                saveFinance(financeWorkspace.id, book, 'Se configuró el espacio de finanzas.')
              }}
            />
          ) : null}

          {financeResult?.kind === 'events' ? (
            <FinanceConfirm
              events={financeResult.events}
              onConfirm={() => {
                if (!financeWorkspace) return
                const committed = commitParsedEvents(
                  ensureFinanceBook(financeWorkspace.finance),
                  financeWorkspace.id,
                  financeResult.events,
                )
                saveFinance(
                  financeWorkspace.id,
                  committed.book,
                  `Se registraron ${committed.events.length} movimientos financieros.`,
                )
                for (const event of committed.events) {
                  saveRecord(financeWorkspace.id, recordValuesFromEvent(event))
                }
                setBatchReward(
                  committed.events.length > 1
                    ? `Registré ${committed.events.length} movimientos.`
                    : 'Listo, lo anoté en Finanzas.',
                )
                setFinanceResult(null)
              }}
              onEdit={() => {
                setCorrectingBatch(true)
                setPrompt(financeSource.current)
                setFinanceResult(null)
              }}
            />
          ) : null}

          {globalQuestion ? (
            <div className="rounded-2xl border border-white/0 bg-violet-50 px-4 py-3" data-testid="global-clarification">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
                {plain ? 'Una cosa más' : 'Necesito un dato más'}
              </p>
              <p className="mt-1.5 text-sm text-ink">{globalQuestion}</p>
            </div>
          ) : null}

          {confirmable.length > 0 && !correctingBatch ? (
            <div className="space-y-4" data-testid="capture-batch">
              <p className="text-[15px] leading-6 text-ink">
                {confirmable.length === 1
                  ? '1 cosa detectada'
                  : `${confirmable.length} cosas detectadas`}
              </p>
              <ul className="space-y-2">
                {confirmable.map((intent) => (
                  <li key={intent.id} className="text-[15px] leading-6 text-ink">
                    {captureIntentLine(
                      intent.workspaceName,
                      workspaces.find((item) => item.id === intent.workspaceId),
                      intent.capture,
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCorrectingBatch(true)}>
                  Corregir
                </Button>
                <Button onClick={confirmAll} disabled={Boolean(busyIntentId)}>
                  Registrar todo
                </Button>
              </div>
            </div>
          ) : null}

          {intents
            .filter((intent) => {
              if (intent.status !== 'pending') return intent.status === 'saved'
              if (intent.capture.kind === 'new_record' || intent.capture.kind === 'update_record') {
                return correctingBatch
              }
              return true
            })
            .map((intent) => (
            <IntentCard
              key={intent.id}
              intent={intent}
              workspace={workspaces.find((item) => item.id === intent.workspaceId)}
              plain={plain}
              busy={busyIntentId === intent.id}
              onConfirm={() => confirmIntent(intent)}
              onDismiss={() =>
                setIntents((current) =>
                  current.map((item) => (item.id === intent.id ? { ...item, status: 'dismissed' } : item)),
                )
              }
              onCorrect={(text, extras) => void patchIntent(intent, text, extras)}
              onChoose={(candidate) =>
                void patchIntent(intent, `Me refiero a ${candidate.title}.`, {
                  selectedRecordId: candidate.id,
                })
              }
            />
          ))}

          {createSpace ? (
            <div className="rounded-2xl border border-line bg-canvas p-4" data-testid="create-space-offer">
              <p className="text-[15px] leading-6 text-ink">
                {plain
                  ? 'Esto no encaja en lo que ya mides. ¿Armamos un espacio nuevo para anotarlo?'
                  : 'No corresponde a ningún espacio existente. Puedes crear uno nuevo para esto.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCreateSpace(null)}>
                  {plain ? 'Ahora no' : 'Descartar'}
                </Button>
                <Button onClick={() => void startCreateSpace(createSpace.seed)}>
                  {plain ? 'Sí, armar espacio' : 'Crear espacio'}
                </Button>
              </div>
            </div>
          ) : null}

          {status === 'loading' || creationStatus === 'loading' ? (
            <AiWorkingState step="understanding" />
          ) : null}

          {status === 'error' || creationStatus === 'error' ? (
            <div className="rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
              <p>{error || creationError}</p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => {
                  if (creationStatus === 'error' && createSpace) {
                    void startCreateSpace(createSpace.seed)
                    return
                  }
                  const attempt = lastAttempt.current
                  if (!attempt) return
                  void submitGlobal(attempt)
                }}
              >
                {plain ? 'Intentarlo de nuevo' : 'Reintentar'}
              </Button>
            </div>
          ) : null}

          {showPrompt ? (
            <PromptBox
              compact
              inputId="nexora-prompt-global"
              value={prompt}
              busy={false}
              voiceScope="global"
              placeholder={
                plain
                  ? 'Graba el día o escríbelo: gastos, colegios, lo que sea…'
                  : 'Cuéntame el día, aunque mezcle varios espacios'
              }
              onChange={setPrompt}
              onSubmit={() => {
                if (dialogueState.stage === 'awaiting_clarification') {
                  void startCreateSpace(prompt)
                  setPrompt('')
                  return
                }
                void submitGlobal(prompt)
              }}
              onVoiceTranscript={(text) => {
                setHeard(text)
                setPrompt(text)
                void submitGlobal(text)
              }}
              onSoon={(message) => showToast(message)}
            />
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            {pendingIntents.length > 0 ? (plain ? 'Cerrar' : 'Cerrar') : plain ? 'Listo' : 'Cerrar'}
          </Button>
          {confirmable.length > 0 && correctingBatch ? (
            <Button onClick={confirmAll} disabled={Boolean(busyIntentId)}>
              Registrar todo
            </Button>
          ) : null}
        </div>
      </Modal>

      <CreationFlow
        proposal={proposal}
        status={creationStatus === 'ready' ? 'ready' : 'idle'}
        errorMessage={creationError}
        onClose={() => {
          setProposal(null)
          setCreationStatus('idle')
          setCreationError(null)
        }}
        onRetry={() => {
          if (createSpace) void startCreateSpace(createSpace.seed)
        }}
        onOpened={(id) => {
          close()
          navigate(`/workspaces/${id}`)
        }}
      />
    </>
  )
}

function IntentCard({
  intent,
  workspace,
  plain,
  busy,
  onConfirm,
  onDismiss,
  onCorrect,
  onChoose,
}: {
  intent: IntentState
  workspace?: Workspace
  plain: boolean
  busy: boolean
  onConfirm: () => void
  onDismiss: () => void
  onCorrect: (
    text: string,
    extras?: {
      selectedRecordId?: string
      previousProposal?: {
        kind: 'new_record' | 'update_record'
        recordId?: string
        values: Record<string, FieldValue>
      }
    },
  ) => void
  onChoose: (candidate: { id: string; title: string }) => void
}) {
  const [correcting, setCorrecting] = useState(false)
  const [correction, setCorrection] = useState('')
  const capture = intent.capture
  const existing: RecordItem | undefined =
    workspace && capture.kind === 'update_record'
      ? workspace.records.find((record) => record.id === capture.recordId)
      : undefined

  if (intent.status === 'dismissed') return null
  if (intent.status === 'saved') {
    return (
      <SaveReward
        compact
        text={intent.insight ?? (plain ? `Listo, lo anoté en ${intent.workspaceName}.` : `Guardado en ${intent.workspaceName}.`)}
      />
    )
  }

  const headline =
    capture.kind === 'new_record' || capture.kind === 'update_record'
      ? captureHeadline(
          capture.kind,
          intent.workspaceName,
          existing ? recordTitle(existing, 'esto', workspace) : undefined,
          plain,
        )
      : intent.workspaceName

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4" data-testid="capture-intent-card">
      <p className="text-sm font-semibold text-ink">{headline}</p>

      {capture.kind === 'needs_clarification' ? (
        <p className="text-sm text-ink">{capture.question}</p>
      ) : null}

      {capture.kind === 'needs_disambiguation' ? (
        <div className="space-y-2">
          <p className="text-sm text-ink">{capture.question}</p>
          <div className="grid gap-2">
            {capture.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                data-testid="capture-candidate"
                disabled={busy}
                onClick={() => onChoose(candidate)}
                className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm hover:border-slate-300"
              >
                <span className="font-medium text-ink">{candidate.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {workspace && (capture.kind === 'new_record' || capture.kind === 'update_record') ? (
        <CapturePreview workspace={workspace} result={capture} existing={existing} plain={plain} />
      ) : null}

      {correcting ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {plain ? '¿Qué está mal o qué falta?' : 'Corrección'}
          </label>
          <textarea
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-line px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            placeholder={plain ? 'Ej. era correo, no WhatsApp' : 'Ej. el canal fue correo, no WhatsApp'}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCorrecting(false)}>
              Volver
            </Button>
            <Button
              disabled={!correction.trim() || busy}
              onClick={() => {
                if (capture.kind !== 'new_record' && capture.kind !== 'update_record') return
                onCorrect(correction, {
                  previousProposal: {
                    kind: capture.kind,
                    recordId: capture.kind === 'update_record' ? capture.recordId : undefined,
                    values: capture.values,
                  },
                })
                setCorrecting(false)
                setCorrection('')
              }}
            >
              {plain ? 'Listo' : 'Enviar corrección'}
            </Button>
          </div>
        </div>
      ) : null}

      {busy ? <p className="text-sm text-muted">{captureLoadingCopy(plain)}</p> : null}

      {capture.kind === 'needs_clarification' && !correcting ? (
        <IntentFollowUp
          plain={plain}
          busy={busy}
          onSubmit={(text) => onCorrect(text)}
        />
      ) : null}

      {capture.kind === 'new_record' || capture.kind === 'update_record' ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onDismiss} disabled={busy}>
            {plain ? 'Cancelar' : 'Cancelar'}
          </Button>
          <Button variant="secondary" onClick={() => setCorrecting(true)} disabled={busy}>
            Corregir
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {captureConfirmLabel(plain)}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onDismiss} disabled={busy}>
            {plain ? 'Esto no' : 'Descartar'}
          </Button>
        </div>
      )}
    </div>
  )
}

function IntentFollowUp({
  plain,
  busy,
  onSubmit,
}: {
  plain: boolean
  busy: boolean
  onSubmit: (text: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <div className="flex gap-2">
      <input
        value={value}
        disabled={busy}
        onChange={(event) => setValue(event.target.value)}
        placeholder={plain ? 'Tu respuesta' : 'Respuesta'}
        className="min-h-11 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-slate-400"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim()) {
            onSubmit(value)
            setValue('')
          }
        }}
      />
      <Button
        disabled={!value.trim() || busy}
        onClick={() => {
          onSubmit(value)
          setValue('')
        }}
      >
        Enviar
      </Button>
    </div>
  )
}
