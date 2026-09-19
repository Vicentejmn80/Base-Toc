import { useState, type ReactNode } from 'react'
import { Beaker, HelpCircle, Lightbulb, Search } from 'lucide-react'
import type { Workspace } from '../../domain/types'
import { formatReviewDate, saveExperiment } from '../../lib/experiments'
import { buildLocalCoach } from '../../metrics/coach'

export function ProgressCoach({ workspaces }: { workspaces: Workspace[] }) {
  const [version, setVersion] = useState(0)
  const coach = buildLocalCoach(workspaces)
  if (!coach) return null
  const review = coach.review

  return (
    <section data-testid="progress-coach" className="space-y-3" key={version}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Coach</p>

      <CoachCard icon={<Search size={15} />} label="Observación">
        <p className="text-[15px] leading-6 text-ink">{coach.observation}</p>
        <p className="mt-1.5 text-sm leading-6 text-muted">{coach.context}</p>
      </CoachCard>

      <CoachCard
        icon={<Lightbulb size={15} />}
        label="Hipótesis"
        tag="Posible explicación"
        className="border-amber-100 bg-amber-50/70"
      >
        <p className="text-[15px] italic leading-6 text-ink/80">{coach.hypothesis}</p>
      </CoachCard>

      <CoachCard icon={<HelpCircle size={15} />} label="Pregunta">
        <p className="text-[15px] leading-6 text-ink">{coach.question}</p>
      </CoachCard>

      {review ? (
        <div
          data-testid="coach-experiment"
          className="rounded-3xl border border-violet-200 bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_45%,#fdf2f8_100%)] px-4 py-4"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            <Beaker size={14} />
            {review.status === 'due' ? 'Revisión' : 'Experimento'}
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-ink">{review.descripcion}</p>
          <p className="mt-1 text-[15px] leading-6 text-ink/80">{review.summary}</p>
          {review.status === 'running' && review.daysLeft !== undefined ? (
            <p className="mt-2 text-xs text-muted">
              Se revisa el {formatReviewDate(review.reviewAt)} · {review.daysLeft} días.
            </p>
          ) : null}
        </div>
      ) : (
        <div
          data-testid="coach-experiment"
          className="rounded-3xl border border-violet-200 bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_45%,#fdf2f8_100%)] px-4 py-4"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            <Beaker size={14} />
            Experimento
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-ink">{coach.experiment.descripcion}</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-violet-800 underline-offset-4 hover:underline"
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

function CoachCard({
  icon,
  label,
  tag,
  className,
  children,
}: {
  icon: ReactNode
  label: string
  tag?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded-3xl border border-line bg-white px-4 py-3.5 ${className ?? ''}`}>
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {icon}
        {label}
      </p>
      {tag ? <p className="mt-1 text-[11px] font-medium tracking-wide text-amber-800">{tag}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  )
}
