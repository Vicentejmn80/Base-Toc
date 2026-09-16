import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { PromptBox } from '../home/PromptBox'
import { WorkspaceIcon } from '../ui/WorkspaceIcon'
import { MomentCard } from './MomentCard'
import { greetingForNow } from '../../lib/dates'
import {
  buildCrossSpaceHeadline,
  mostActiveWorkspace,
  spaceOneLiner,
} from '../../lib/homeStory'
import { humanizeActivity } from '../../lib/humanizeActivity'
import type { ActivityEvent, Workspace } from '../../domain/types'

interface MobileHomeStoryProps {
  workspaces: Workspace[]
  activities: ActivityEvent[]
  prompt: string
  busy: boolean
  assistantQuestion: string | null
  onPromptChange: (value: string) => void
  onSubmit: () => void
  onVoiceTranscript: (text: string) => void
  onSoon: (message: string) => void
}

export function MobileHomeStory({
  workspaces,
  activities,
  prompt,
  busy,
  assistantQuestion,
  onPromptChange,
  onSubmit,
  onVoiceTranscript,
  onSoon,
}: MobileHomeStoryProps) {
  const [createOpen, setCreateOpen] = useState(Boolean(assistantQuestion) || busy)
  const headline = buildCrossSpaceHeadline(workspaces)
  const highlight = mostActiveWorkspace(workspaces)
  const latest = [...activities]
    .filter((item) => item.type !== 'workspace_created')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)

  return (
    <div className="space-y-4 px-4 pb-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
      <header className="px-1 pt-2">
        <p className="text-sm text-muted">{greetingForNow()}</p>
        <h1 className="type-title mt-1">Cómo te fue</h1>
        <p className="mt-2 text-[17px] leading-7 text-ink">{headline}</p>
      </header>

      {highlight ? (
        <Link to={`/workspaces/${highlight.id}`} className="block">
          <MomentCard kicker="Donde más se movió">
            <div className="flex items-start gap-3">
              <WorkspaceIcon name={highlight.icon} color={highlight.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-medium text-ink">{highlight.name}</p>
                <p className="mt-1 text-[15px] leading-6 text-muted">{spaceOneLiner(highlight)}</p>
              </div>
              <ChevronRight className="mt-1 shrink-0 text-slate-300" size={20} />
            </div>
          </MomentCard>
        </Link>
      ) : null}

      {workspaces
        .filter((workspace) => workspace.id !== highlight?.id)
        .map((workspace) => (
        <Link key={workspace.id} to={`/workspaces/${workspace.id}`} className="block">
          <MomentCard>
            <div className="flex items-start gap-3">
              <WorkspaceIcon name={workspace.icon} color={workspace.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{workspace.name}</p>
                <p className="mt-1 text-[15px] leading-6 text-muted">{spaceOneLiner(workspace)}</p>
              </div>
            </div>
          </MomentCard>
        </Link>
      ))}

      {latest.length > 0 ? (
        <MomentCard kicker="Hace poco">
          <ul className="space-y-3">
            {latest.map((activity) => {
              const space = workspaces.find((item) => item.id === activity.workspaceId)
              return (
                <li key={activity.id}>
                  <p className="text-[15px] leading-6 text-ink">{humanizeActivity(activity, space)}</p>
                  {space ? <p className="mt-0.5 text-xs text-muted">{space.name}</p> : null}
                </li>
              )
            })}
          </ul>
        </MomentCard>
      ) : null}

      {createOpen || assistantQuestion ? (
        <div className="pt-2">
          {assistantQuestion ? (
            <p className="mb-3 px-1 text-sm text-ink">{assistantQuestion}</p>
          ) : null}
          <PromptBox
            value={prompt}
            busy={busy}
            voiceScope="home"
            onChange={onPromptChange}
            onSubmit={onSubmit}
            onVoiceTranscript={onVoiceTranscript}
            onSoon={onSoon}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-dashed border-line bg-white text-sm font-medium text-muted"
        >
          Crear un espacio nuevo
        </button>
      )}
    </div>
  )
}
