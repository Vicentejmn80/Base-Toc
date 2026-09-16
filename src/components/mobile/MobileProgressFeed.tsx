import type { ReactNode } from 'react'
import type { ActivityEvent, Goal, Workspace } from '../../domain/types'
import type { PeriodKey } from '../../lib/dates'
import { formatDateTime } from '../../lib/dates'
import { humanizeActivity } from '../../lib/humanizeActivity'
import { mobilePeriodLabel } from '../../lib/periodCopy'
import { buildNarrativeSummary } from '../../metrics/narrative'
import { buildProactiveInsights } from '../../metrics/insights'
import { projectGoal } from '../../metrics/goals'
import { MomentCard } from './MomentCard'
import { Button } from '../ui/Button'

interface MobileProgressFeedProps {
  workspace: Workspace
  period: PeriodKey
  activities: ActivityEvent[]
  onSeeDetail: () => void
  onDefineGoal: () => void
}

export function MobileProgressFeed({
  workspace,
  period,
  activities,
  onSeeDetail,
  onDefineGoal,
}: MobileProgressFeedProps) {
  const narrative = buildNarrativeSummary(workspace, period)
  const insights = buildProactiveInsights(workspace)
  const goal = workspace.goals[0] ?? null
  const moments = buildMoments({ workspace, period, activities, narrative, insights, goal })

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tu progreso</p>
        <h2 className="type-title mt-1">{mobilePeriodLabel(period)}</h2>
      </header>

      {moments.map((moment) => (
        <MomentCard key={moment.id} kicker={moment.kicker} footer={moment.footer}>
          {moment.body}
        </MomentCard>
      ))}

      {!goal ? (
        <MomentCard kicker="Meta">
          <p className="text-[17px] leading-7 text-ink">Todavía no tienes una meta en este espacio.</p>
          <Button className="mt-3 min-h-11" variant="secondary" onClick={onDefineGoal}>
            Definir meta
          </Button>
        </MomentCard>
      ) : null}

      {moments.length === 0 ? (
        <MomentCard>
          <p className="text-[17px] leading-7 text-ink">Aún no hay suficiente historial para contarte cómo te fue.</p>
        </MomentCard>
      ) : null}

      <Button variant="secondary" className="min-h-12 w-full" onClick={onSeeDetail}>
        Ver todo el detalle
      </Button>
    </div>
  )
}

interface FeedMoment {
  id: string
  at: string
  kicker: string
  body: ReactNode
  footer?: React.ReactNode
}

function buildMoments({
  workspace,
  period,
  activities,
  narrative,
  insights,
  goal,
}: {
  workspace: Workspace
  period: PeriodKey
  activities: ActivityEvent[]
  narrative: ReturnType<typeof buildNarrativeSummary>
  insights: ReturnType<typeof buildProactiveInsights>
  goal: Goal | null
}): FeedMoment[] {
  const now = new Date().toISOString()
  const items: FeedMoment[] = []

  if (narrative.lines[0]) {
    items.push({
      id: 'narrative',
      at: now,
      kicker: mobilePeriodLabel(period),
      body: (
        <div className="space-y-2">
          <p className="text-[17px] font-medium leading-7 text-ink">{narrative.lines[0]}</p>
          {narrative.lines.slice(1).map((line) => (
            <p key={line} className="text-[15px] leading-6 text-muted">
              {line}
            </p>
          ))}
        </div>
      ),
    })
  }

  insights.forEach((insight, index) => {
    items.push({
      id: `insight-${insight.id}`,
      at: new Date(Date.now() - (2000 + index * 1000)).toISOString(),
      kicker: 'Para que lo sepas',
      body: <p className="text-[17px] leading-7 text-ink">{insight.text}</p>,
    })
  })

  if (goal) {
    const projection = projectGoal(workspace, goal)
    items.push({
      id: 'goal',
      at: new Date(Date.now() - 500).toISOString(),
      kicker: 'Tu meta',
      body: (
        <div>
          <p className="text-[17px] font-medium leading-7 text-ink">
            Vas en {projection.displayCurrent} de {projection.displayTarget}.
          </p>
          <p className="mt-1.5 text-[15px] leading-6 text-muted">{projection.projectionText}</p>
        </div>
      ),
      footer: (
        <div className="h-2.5 rounded-full bg-soft">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#93c5fd,#818cf8,#c084fc)]"
            style={{ width: `${projection.progress}%` }}
          />
        </div>
      ),
    })
  }

  for (const activity of activities) {
    if (activity.type === 'workspace_created') continue
    items.push({
      id: activity.id,
      at: activity.createdAt,
      kicker: 'Hace poco',
      body: <p className="text-[17px] leading-7 text-ink">{humanizeActivity(activity, workspace)}</p>,
      footer: <p className="text-xs text-muted">{formatDateTime(activity.createdAt)}</p>,
    })
  }

  return items.sort((a, b) => b.at.localeCompare(a.at))
}
