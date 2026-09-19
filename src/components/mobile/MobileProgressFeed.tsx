import type { ActivityEvent, Workspace } from '../../domain/types'
import type { PeriodKey } from '../../lib/dates'
import { humanizeActivity } from '../../lib/humanizeActivity'
import { mobilePeriodLabel } from '../../lib/periodCopy'
import { buildProgressObservations, buildAreaProgress } from '../../metrics/progress'
import { projectGoal } from '../../metrics/goals'
import { ActivityHeatmap } from '../progress/ActivityHeatmap'
import { ProgressCompare } from '../progress/ProgressCompare'
import { ProgressInsight } from '../progress/ProgressInsight'
import { Sparkline } from '../progress/Sparkline'

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
  const area = buildAreaProgress(workspace)
  const observations = buildProgressObservations([workspace])
  const goal = workspace.goals[0] ?? null
  const projection = goal ? projectGoal(workspace, goal) : null
  const latest = activities.filter((item) => item.type !== 'workspace_created').slice(0, 4)

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Tu progreso
        </p>
        <h2 className="type-title mt-1">{mobilePeriodLabel(period)}</h2>
      </header>

      <div className="progress-enter flex items-end justify-between gap-4">
        <ProgressCompare area={area} size="lg" />
        <Sparkline values={area.history} className="text-slate-400" />
      </div>

      <ActivityHeatmap workspace={workspace} />

      <ProgressInsight observation={observations} />

      {projection ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Meta</p>
          <p className="text-[17px] leading-7 text-ink">
            Vas en {projection.displayCurrent} de {projection.displayTarget}.
          </p>
          <p className="text-[15px] leading-6 text-muted">{projection.projectionText}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDefineGoal}
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Definir una meta
        </button>
      )}

      {latest.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Hace poco
          </p>
          <ul className="space-y-3">
            {latest.map((activity) => (
              <li key={activity.id} className="text-[15px] leading-6 text-ink">
                {humanizeActivity(activity, workspace)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSeeDetail}
        className="text-sm font-medium text-ink underline-offset-4 hover:underline"
      >
        Ver el detalle
      </button>
    </div>
  )
}
