import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Database, LineChart, Dumbbell, Wallet } from 'lucide-react'
import { PromptBox } from './PromptBox'
import { CreationFlow, type CreationStatus } from '../creation/CreationFlow'
import { WorkspaceIcon } from '../ui/WorkspaceIcon'
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
          : 'No se pudo completar la solicitud a la IA.'
      setCreationStatus('error')
      setCreationError(message)
    }
  }

  const spacesSection = hasSpaces ? (
    <section id="espacios" className="mt-10">
      <div className="mb-5">
        <h2 className="type-section">Espacios recientes</h2>
        <p className="type-meta mt-1">Sistemas que ya estás midiendo.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            to={`/workspaces/${workspace.id}`}
            className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
          >
            <WorkspaceIcon name={workspace.icon} color={workspace.color} />
            <p className="mt-3 font-medium">{workspace.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{workspace.description}</p>
            <p className="mt-3 text-xs text-slate-400">{workspace.records.length} registros</p>
          </Link>
        ))}
      </div>
    </section>
  ) : null

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

  return (
    <div>
      <section className="home-hero">
        <div className="home-blob home-blob-a" aria-hidden="true" />
        <div className="home-blob home-blob-b" aria-hidden="true" />
        <div className="home-blob home-blob-c" aria-hidden="true" />
        <div className="home-hero-fade" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6">
          <header className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15">
                N
              </span>
              <span className="font-semibold text-white">Nexora</span>
            </div>
          </header>

          <div className="animate-fade-up pt-8 text-center sm:pt-16">
            <p className="text-sm text-slate-300">{greetingForNow()}</p>
            <h1 className="type-display mt-3 text-white">
              ¿Qué quieres crear o medir hoy?
            </h1>
          </div>

          <div className="animate-fade-up mt-8" style={{ animationDelay: '80ms' }}>
            {assistantQuestion ? (
              <div className="mb-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-200">
                  Clarificación
                </p>
                <p className="mt-1.5 text-sm text-slate-100">{assistantQuestion}</p>
              </div>
            ) : null}
            <PromptBox
              value={prompt}
              busy={creationStatus === 'loading'}
              voiceScope="home"
              onChange={setPrompt}
              onSubmit={() => startFromPrompt(prompt)}
              onVoiceTranscript={(text) => {
                startFromPrompt(text)
              }}
              onSoon={(message) => showToast(message)}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
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

        {hasSpaces ? spacesSection : gallery}
        {hasSpaces ? gallery : spacesSection}

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
      </div>
    </div>
  )
}
