import { Link } from 'react-router-dom'
import type { AreaProgress } from '../../metrics/progress'
import { WorkspaceIcon } from '../ui/WorkspaceIcon'
import { ProgressCompare } from './ProgressCompare'
import { Sparkline } from './Sparkline'

export function AreaProgressList({
  areas,
  className,
}: {
  areas: AreaProgress[]
  className?: string
}) {
  if (areas.length === 0) return null

  return (
    <section id="espacios" className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Áreas activas
      </p>
      <ul>
        {areas.map((area, index) => (
          <li key={area.workspaceId} className="border-b border-line/70 last:border-b-0">
            <Link
              to={`/workspaces/${area.workspaceId}`}
              className="progress-enter flex items-center gap-3 py-3.5"
              style={{ animationDelay: `${index * 45}ms` }}
              data-testid={`area-progress-${area.workspaceId}`}
            >
              <WorkspaceIcon name={area.icon} color={area.color} size="sm" kind={area.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-muted">{area.workspaceName}</p>
                <ProgressCompare area={area} />
              </div>
              <Sparkline values={area.history} className="shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
