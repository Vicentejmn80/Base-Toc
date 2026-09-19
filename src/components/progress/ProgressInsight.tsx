import { cn } from '../../lib/cn'
import type { ProgressObservation } from '../../metrics/progress'

export function ProgressInsight({
  observation,
  className,
}: {
  observation: ProgressObservation | null
  className?: string
}) {
  if (!observation) return null

  return (
    <section data-testid="progress-insight" className={cn('space-y-2', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Observación
      </p>
      <p className="text-[17px] leading-7 text-ink">{observation.primary}</p>
      {observation.context ? (
        <p className="text-[15px] leading-6 text-ink/80">{observation.context}</p>
      ) : null}
      {observation.secondary ? (
        <p className="text-[13px] leading-6 text-muted">{observation.secondary}</p>
      ) : null}
    </section>
  )
}
