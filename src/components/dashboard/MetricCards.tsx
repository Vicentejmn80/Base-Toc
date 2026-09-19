import type { Workspace } from '../../domain/types'
import { buildAreaProgress } from '../../metrics/progress'
import { Sparkline } from '../progress/Sparkline'
import { cn } from '../../lib/cn'

export function MetricCards({ workspace }: { workspace: Workspace }) {
  const area = buildAreaProgress(workspace)

  return (
    <section data-testid={`metric-${area.label}`} className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {area.periodLabel}
      </p>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[1.75rem] font-semibold tracking-tight text-ink">{area.shortDisplay}</p>
          <p
            className={cn(
              'mt-1 text-sm',
              area.direction === 'up' && 'text-success',
              area.direction === 'down' && 'text-warning',
              area.direction === 'flat' && 'text-muted',
            )}
          >
            {area.comparison}
          </p>
        </div>
        <Sparkline
          values={area.history}
          className={cn(
            'mb-1',
            area.direction === 'up' && 'text-emerald-500',
            area.direction === 'down' && 'text-amber-500',
          )}
        />
      </div>
    </section>
  )
}
