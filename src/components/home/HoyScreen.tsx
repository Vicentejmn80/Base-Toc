import { useState } from 'react'
import type { Workspace } from '../../domain/types'
import { greetingForNow } from '../../lib/dates'
import { useGlobalCapture } from '../../state/globalCapture'
import {
  buildHomeProgress,
  buildProgressObservations,
  buildWeeklySummary,
} from '../../metrics/progress'
import { AreaProgressList } from '../progress/AreaProgressList'
import { ProgressCoach } from '../progress/ProgressCoach'
import { ProgressInsight } from '../progress/ProgressInsight'
import { CommitmentsToday } from './CommitmentsToday'
import { PromptBox } from './PromptBox'

interface HoyScreenProps {
  workspaces: Workspace[]
  createPrompt: string
  createBusy: boolean
  assistantQuestion: string | null
  onCreatePromptChange: (value: string) => void
  onCreateSubmit: () => void
  onCreateVoice: (text: string) => void
  onSoon: (message: string) => void
}

export function HoyScreen({
  workspaces,
  createPrompt,
  createBusy,
  assistantQuestion,
  onCreatePromptChange,
  onCreateSubmit,
  onCreateVoice,
  onSoon,
}: HoyScreenProps) {
  const { openCapture } = useGlobalCapture()
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(Boolean(assistantQuestion) || createBusy)
  const areas = buildHomeProgress(workspaces)
  const summary = buildWeeklySummary(workspaces)
  const observations = buildProgressObservations(workspaces)

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-[max(0.85rem,env(safe-area-inset-top))] sm:px-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">{greetingForNow()}</p>
        <h1 className="type-title">Cómo te fue</h1>
        <p className="text-[17px] leading-7 text-ink">{summary}</p>
      </header>

      <div className="mt-8">
        <PromptBox
          value={prompt}
          voiceScope="global"
          placeholder="Cuéntame qué pasó... o qué se viene."
          onChange={setPrompt}
          onSubmit={() => {
            const next = prompt.trim()
            if (!next) return
            openCapture(next)
            setPrompt('')
          }}
          onVoiceTranscript={(text) => {
            openCapture(text)
            setPrompt('')
          }}
          onSoon={onSoon}
        />
      </div>

      <div className="mt-10 space-y-10">
        <CommitmentsToday workspaces={workspaces} />
        <ProgressInsight observation={observations} />
        <AreaProgressList areas={areas} />
        <ProgressCoach workspaces={workspaces} />
      </div>

      <div className="mt-10">
        {creating || assistantQuestion ? (
          <div className="space-y-3">
            {assistantQuestion ? (
              <p className="text-[15px] leading-6 text-ink">{assistantQuestion}</p>
            ) : (
              <p className="text-sm text-muted">Cuéntame qué quieres medir.</p>
            )}
            <PromptBox
              compact
              value={createPrompt}
              busy={createBusy}
              voiceScope="home"
              placeholder="Quiero medir…"
              onChange={onCreatePromptChange}
              onSubmit={onCreateSubmit}
              onVoiceTranscript={onCreateVoice}
              onSoon={onSoon}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Quiero medir algo nuevo
          </button>
        )}
      </div>
    </div>
  )
}
