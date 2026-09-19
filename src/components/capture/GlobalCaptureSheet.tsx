import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FieldValue, RecordItem, Workspace, WorkspaceProposal } from '../../domain/types'
import { AiRequestError } from '../../lib/aiClient'
import {
  captureConfirmLabel,
  captureHeadline,
  captureLoadingCopy,
  captureSavedToast,
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
import { useAppStore } from '../../state/store'
import { useToast } from '../../state/toast'
import { CreationFlow, type CreationStatus } from '../creation/CreationFlow'
import { PromptBox } from '../home/PromptBox'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { CapturePreview } from './CapturePreview'
import { AiWorkingState } from './AiWorkingState'

type Status = 'idle' | 'loading' | 'error'
type HistoryTurn = { role: 'user' | 'assistant'; content: string }

interface IntentState {
  id: string
  workspaceId: string
  workspaceName: string
  capture: CaptureResult
  status: 'pending' | 'saved' | 'dismissed'
}

interface GlobalCaptureSheetProps {
  open: boolean
  seed?: string
  onClose: () => void
}

export function GlobalCaptureSheet({ open, seed, onClose }: GlobalCaptureSheetProps) {
  const plain = usePlainLanguage()
  const navigate = useNavigate()
  const { workspaces, saveRecord } = useAppStore()
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

    try {
      const result = await requestGlobalCapture(
        { message: next, workspaces, history },
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

  function confirmIntent(intent: IntentState, options?: { silent?: boolean }) {
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
    saveRecord(workspace.id, mergeCaptureValues(workspace, capture.values, existing), existing)
    setIntents((current) =>
      current.map((item) => (item.id === intent.id ? { ...item, status: 'saved' } : item)),
    )
    if (!options?.silent) {
      showToast(captureSavedToast(workspace.name, Boolean(existing), plain), 'success')
    }
  }

  function confirmAll() {
    const ready = intents.filter(
      (intent) =>
        intent.status === 'pending' &&
        (intent.capture.kind === 'new_record' || intent.capture.kind === 'update_record'),
    )
    ready.forEach((intent) => confirmIntent(intent, { silent: true }))
    if (ready.length) {
      showToast(
        plain ? `Listo, anoté ${ready.length === 1 ? 'eso' : `las ${ready.length} cosas`}` : 'Cambios guardados',
        'success',
      )
    }
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
  const showPrompt =
    status !== 'loading' &&
    creationStatus !== 'loading' &&
    !busyIntentId &&
    (Boolean(globalQuestion) || (!hasConfirmable && !hasIntentFollowup))

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
          {heard ? (
            <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {plain ? 'Esto es lo que te escuché' : 'Transcripción'}
              </p>
              <p className="mt-1.5 text-[15px] leading-6 text-ink">“{heard}”</p>
            </div>
          ) : null}

          {globalQuestion ? (
            <div className="rounded-2xl border border-white/0 bg-violet-50 px-4 py-3" data-testid="global-clarification">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
                {plain ? 'Una cosa más' : 'Necesito un dato más'}
              </p>
              <p className="mt-1.5 text-sm text-ink">{globalQuestion}</p>
            </div>
          ) : null}

          {intents.map((intent) => (
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
          {confirmable.length > 1 ? (
            <Button onClick={confirmAll} disabled={Boolean(busyIntentId)}>
              {plain ? 'Anotar todo' : 'Confirmar todo'}
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
      <div className="rounded-2xl border border-emerald-100 bg-success-soft px-4 py-3 text-sm text-success">
        {plain ? `Listo, lo anoté en ${intent.workspaceName}.` : `Guardado en ${intent.workspaceName}.`}
      </div>
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
