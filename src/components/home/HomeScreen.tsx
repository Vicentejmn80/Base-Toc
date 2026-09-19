import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Database, LineChart, Dumbbell, Wallet } from 'lucide-react'
import { PromptBox } from './PromptBox'
import { CreationFlow, type CreationStatus } from '../creation/CreationFlow'
import { ExamplesGallery } from './ExamplesGallery'
import { useAppStore } from '../../state/store'
import { useToast } from '../../state/toast'
import { greetingForNow } from '../../lib/dates'
import {
  continueCreationDialogue,
  emptyDialogueState,
  startCreationDialogue,
  type CreationDialogueState,
} from '../../lib/creationDialogue'
import { AiRequestError } from '../../lib/aiClient'
import type { WorkspaceProposal } from '../../domain/types'
import { exampleGallery } from '../../data/exampleGallery'
import { HoyScreen } from './HoyScreen'

const quickActions = [
  {
    id: 'database',
    label: 'Crear una base de datos',
    icon: Database,
    prompt: 'Quiero crear una base de datos para organizar mis registros y darles seguimiento.',
  },
  {
    id: 'progress',
    label: 'Medir mi progreso',
    icon: LineChart,
    prompt:
      'Quiero registrar los colegios que contacto para Aulas Inca, saber si respondieron, por qué medio los contacté y cuándo debo hacer seguimiento.',
  },
  {
    id: 'finance',
    label: 'Organizar mis gastos',
    icon: Wallet,
    prompt: 'Quiero organizar mis ingresos, gastos y ahorro.',
  },
  {
    id: 'training',
    label: 'Registrar mis entrenamientos',
    icon: Dumbbell,
    prompt: 'Quiero registrar mis entrenamientos de running y pesas.',
  },
]

export function HomeScreen() {
  const { workspaces } = useAppStore()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [prompt, setPrompt] = useState('')
  const [proposal, setProposal] = useState<WorkspaceProposal | null>(null)
  const [assistantQuestion, setAssistantQuestion] = useState<string | null>(null)
  const [dialogueState, setDialogueState] = useState<CreationDialogueState>(emptyDialogueState)
  const [creationStatus, setCreationStatus] = useState<CreationStatus>('idle')
  const [creationError, setCreationError] = useState<string | null>(null)
  const lastAttempt = useRef<{ message: string; state: CreationDialogueState } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hasSpaces = workspaces.length > 0

  useEffect(() => {
    if (location.hash === '#espacios') {
      document.getElementById('espacios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  function resetCreation() {
    abortRef.current?.abort()
    abortRef.current = null
    setProposal(null)
    setCreationStatus('idle')
    setCreationError(null)
  }

  async function startFromPrompt(text: string, state = dialogueState) {
    const next = text.trim()
    if (!next) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    lastAttempt.current = { message: next, state }

    setCreationStatus('loading')
    setCreationError(null)
    setProposal(null)

    try {
      const result =
        state.stage === 'awaiting_clarification'
          ? await continueCreationDialogue(state, next, workspaces, controller.signal)
          : await startCreationDialogue(next, workspaces, controller.signal)

      if (result.kind === 'ask') {
        setAssistantQuestion(result.question.text)
        setDialogueState(result.state)
        setPrompt('')
        setCreationStatus('idle')
        return
      }

      setAssistantQuestion(null)
      setDialogueState(result.state)
      setProposal(result.proposal)
      setCreationStatus('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      const message =
        error instanceof AiRequestError
          ? error.message
          : 'No pude completar eso ahora. ¿Lo intentamos de nuevo?'
      setCreationStatus('error')
      setCreationError(message)
    }
  }

  function handleHomeSubmit(text: string) {
    const next = text.trim()
    if (!next) return
    void startFromPrompt(next)
  }

  const gallery = (
    <ExamplesGallery
      examples={exampleGallery}
      defaultCollapsed={hasSpaces}
      onCreate={(nextPrompt) => {
        setAssistantQuestion(null)
        setDialogueState(emptyDialogueState())
        startFromPrompt(nextPrompt, emptyDialogueState())
      }}
      onCustomize={(nextPrompt) => {
        setPrompt(nextPrompt)
        setAssistantQuestion(null)
        setDialogueState(emptyDialogueState())
      }}
    />
  )

  const creationFlow = (
    <CreationFlow
      proposal={proposal}
      status={creationStatus}
      errorMessage={creationError}
      onClose={resetCreation}
      onRetry={() => {
        const attempt = lastAttempt.current
        if (!attempt) return
        startFromPrompt(attempt.message, attempt.state)
      }}
      onOpened={(id) => {
        resetCreation()
        setPrompt('')
        setAssistantQuestion(null)
        setDialogueState(emptyDialogueState())
        navigate(`/workspaces/${id}`)
      }}
    />
  )

  if (hasSpaces) {
    return (
      <div>
        <HoyScreen
          workspaces={workspaces}
          createPrompt={prompt}
          createBusy={creationStatus === 'loading'}
          assistantQuestion={assistantQuestion}
          onCreatePromptChange={setPrompt}
          onCreateSubmit={() => void startFromPrompt(prompt)}
          onCreateVoice={(text) => void startFromPrompt(text)}
          onSoon={(message) => showToast(message)}
        />
        {creationFlow}
      </div>
    )
  }

  return (
    <div>
      <section className="mx-auto max-w-xl px-4 pb-2 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-12">
        <div className="animate-fade-up">
          <p className="text-sm text-muted">{greetingForNow()}</p>
          <h1 className="type-title mt-2">
            Cuéntame qué quieres medir
          </h1>
        </div>

        <div className="animate-fade-up mt-8" style={{ animationDelay: '80ms' }}>
          {assistantQuestion ? (
            <p className="mb-3 text-[15px] leading-6 text-ink">{assistantQuestion}</p>
          ) : null}
          <PromptBox
            value={prompt}
            busy={creationStatus === 'loading'}
            voiceScope="home"
            placeholder="Cuéntame qué pasó... o qué quieres empezar a medir."
            onChange={setPrompt}
            onSubmit={() => handleHomeSubmit(prompt)}
            onVoiceTranscript={(text) => {
              handleHomeSubmit(text)
            }}
            onSoon={(message) => showToast(message)}
          />
        </div>
      </section>

      <div className="mx-auto max-w-xl px-4 pb-4 sm:px-6">
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setPrompt(action.prompt)
                setAssistantQuestion(null)
                setDialogueState(emptyDialogueState())
                startFromPrompt(action.prompt, emptyDialogueState())
              }}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted transition-colors hover:border-slate-300 hover:text-ink"
            >
              <action.icon size={14} />
              {action.label}
            </button>
          ))}
        </div>

        {gallery}

        {creationFlow}
      </div>
    </div>
  )
}
