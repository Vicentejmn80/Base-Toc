import { Link } from 'react-router-dom'
import type { AreaProgress } from '../../metrics/progress'
import { WorkspaceIcon } from '../ui/WorkspaceIcon'
import { Sparkline } from './Sparkline'
import { cn } from '../../lib/cn'

export function AreaProgressList({
  areas,
  className,
}: {
  areas: AreaProgress[]
  className?: string
}) {
  if (areas.length === 0) return null

  return (
    <section id="espacios" className={cn('space-y-1', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Áreas activas
      </p>
      <ul>
        {areas.map((area) => (
          <li key={area.workspaceId} className="border-b border-line/80 last:border-b-0">
            <Link
              to={`/workspaces/${area.workspaceId}`}
              className="flex items-center gap-3 py-3.5"
              data-testid={`area-progress-${area.workspaceId}`}
            >
              <WorkspaceIcon name={area.icon} color={area.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">{area.workspaceName}</p>
                <p className="mt-0.5 text-[15px] leading-6 text-ink">{area.shortDisplay}</p>
                <p
                  className={cn(
                    'text-xs',
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
                  'shrink-0',
                  area.direction === 'up' && 'text-emerald-500',
                  area.direction === 'down' && 'text-amber-500',
                )}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
