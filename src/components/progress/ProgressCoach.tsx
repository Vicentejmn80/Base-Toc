import { useState } from 'react'
import type { Workspace } from '../../domain/types'
import { saveExperiment } from '../../lib/experiments'
import { buildLocalCoach } from '../../metrics/coach'
import { formatReviewDate } from '../../lib/experiments'

export function ProgressCoach({ workspaces }: { workspaces: Workspace[] }) {
  const [version, setVersion] = useState(0)
  const coach = buildLocalCoach(workspaces)
  if (!coach) return null
  const review = coach.review

  return (
    <section data-testid="progress-coach" className="space-y-4" key={version}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Coach
      </p>

      <CoachLine label="Observación" text={coach.observation} />
      <CoachLine label="Contexto" text={coach.context} />
      <CoachLine label="Hipótesis" text={coach.hypothesis} />
      <CoachLine label="Pregunta" text={coach.question} />

      {review ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            {review.status === 'due' ? 'Revisión' : 'Experimento'}
          </p>
          <p className="text-[15px] leading-6 text-ink">{review.descripcion}</p>
          <p className="text-[15px] leading-6 text-muted">{review.summary}</p>
          {review.status === 'running' && review.daysLeft !== undefined ? (
            <p className="text-xs text-muted">
              Se revisa el {formatReviewDate(review.reviewAt)} · {review.daysLeft} días.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Experimento
          </p>
          <p className="text-[15px] leading-6 text-muted">{coach.experiment.descripcion}</p>
          <button
            type="button"
            className="text-sm font-medium text-ink underline-offset-4 hover:underline"
            onClick={() => {
              saveExperiment(coach.workspaceId, coach.experiment)
              setVersion((current) => current + 1)
            }}
          >
            Empezar 7 días
          </button>
        </div>
      )}
    </section>
  )
}

function CoachLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="text-[15px] leading-6 text-ink">{text}</p>
    </div>
  )
}
