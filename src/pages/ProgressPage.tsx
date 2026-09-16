import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '../state/store'
import { WorkspaceIcon } from '../components/ui/WorkspaceIcon'
import { MomentCard } from '../components/mobile/MomentCard'
import { projectGoal } from '../metrics/goals'
import { spaceOneLiner } from '../lib/homeStory'

export function ProgressPage() {
  const { workspaces } = useAppStore()

  return (
    <div className="space-y-4 pb-4">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Nexora</p>
        <h1 className="type-title mt-1">Cómo te fue</h1>
        <p className="type-meta mt-1">Un vistazo a cada espacio, en frases.</p>
      </header>
      {workspaces.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Crea un espacio para ver tu progreso.
        </p>
      ) : (
        workspaces.map((workspace) => {
          const goal = workspace.goals[0]
          const projection = goal ? projectGoal(workspace, goal) : null
          return (
            <Link key={workspace.id} to={`/workspaces/${workspace.id}`} className="block">
              <MomentCard>
                <div className="flex items-start gap-3">
                  <WorkspaceIcon name={workspace.icon} color={workspace.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{workspace.name}</p>
                    <p className="mt-1 text-[15px] leading-6 text-muted">{spaceOneLiner(workspace)}</p>
                    {projection ? (
                      <>
                        <p className="mt-3 text-sm text-ink">
                          Vas en {projection.displayCurrent} de {projection.displayTarget}.
                        </p>
                        <div className="mt-2 h-2 rounded-full bg-soft">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#93c5fd,#818cf8,#c084fc)]"
                            style={{ width: `${projection.progress}%` }}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-1 shrink-0 text-slate-300" size={20} />
                </div>
              </MomentCard>
            </Link>
          )
        })
      )}
    </div>
  )
}
