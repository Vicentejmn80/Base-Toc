import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../state/store'
import { WorkspaceIcon } from '../components/ui/WorkspaceIcon'
import { GoalCard } from '../components/dashboard/GoalCard'
import { computeMetrics } from '../metrics'

export function ProgressPage() {
  const { workspaces } = useAppStore()
  const navigate = useNavigate()

  return (
    <div className="space-y-5 pb-4">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Nexora</p>
        <h1 className="type-title mt-1">Progreso</h1>
        <p className="type-meta mt-1">El mismo resumen de cada espacio, en un solo lugar.</p>
      </header>
      {workspaces.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Crea un espacio para ver tu progreso.
        </p>
      ) : (
        <div className="space-y-4">
          {workspaces.map((workspace) => {
            const metrics = computeMetrics(workspace).slice(0, 3)
            return (
              <section key={workspace.id} className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                <Link to={`/workspaces/${workspace.id}`} className="flex min-h-11 items-center gap-3">
                  <WorkspaceIcon name={workspace.icon} color={workspace.color} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{workspace.name}</span>
                    <span className="block text-xs text-muted">{metrics.map((metric) => metric.display).join(' · ')}</span>
                  </span>
                </Link>
                <GoalCard
                  workspace={workspace}
                  goal={workspace.goals[0] ?? null}
                  onDefineGoal={() => navigate(`/workspaces/${workspace.id}`)}
                />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
