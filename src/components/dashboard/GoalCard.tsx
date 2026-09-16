import type { Goal, Workspace } from '../../domain/types'
import { formatDate } from '../../lib/dates'
import { projectGoal } from '../../metrics/goals'
import { Button } from '../ui/Button'

interface GoalCardProps {
  workspace: Workspace
  goal: Goal | null
  onDefineGoal: () => void
}

export function GoalCard({ workspace, goal, onDefineGoal }: GoalCardProps) {
  if (!goal) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-white px-5 py-4">
        <p className="text-sm font-semibold text-ink">Meta</p>
        <p className="mt-1 text-sm text-muted">
          Define una meta para proyectar tu avance con el ritmo real de tus registros.
        </p>
        <Button className="mt-3" variant="secondary" onClick={onDefineGoal}>
          Definir meta
        </Button>
      </section>
    )
  }

  const projection = projectGoal(workspace, goal)

  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{goal.label}</p>
          <p className="mt-1 text-xs text-muted">
            Límite: {goal.deadline ? formatDate(goal.deadline) : 'Sin fecha'}
          </p>
        </div>
        <Button variant="secondary" onClick={onDefineGoal}>
          Editar meta
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted">
        {projection.displayCurrent} de {projection.displayTarget}
      </p>
      <div className="mt-2 h-2 rounded-full bg-soft">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#93c5fd,#818cf8,#c084fc)] transition-[width]"
          style={{ width: `${projection.progress}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink">{projection.projectionText}</p>
    </section>
  )
}
