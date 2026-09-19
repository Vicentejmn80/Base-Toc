import type { Workspace } from '../../domain/types'
import { buildAreaProgress } from '../../metrics/progress'
import { ProgressCompare } from '../progress/ProgressCompare'
import { Sparkline } from '../progress/Sparkline'

export function MetricCards({ workspace }: { workspace: Workspace }) {
  const area = buildAreaProgress(workspace)

  return (
    <section data-testid={`metric-${area.label}`} className="progress-enter">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {area.periodLabel}
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <ProgressCompare area={area} size="lg" />
        <Sparkline values={area.history} className="mb-1 text-slate-400" />
      </div>
    </section>
  )
}
