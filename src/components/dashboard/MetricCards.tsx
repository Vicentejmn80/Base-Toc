import type { ComputedMetric } from '../../domain/types'

export function MetricCards({ metrics }: { metrics: ComputedMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article
          key={metric.id}
          data-testid={`metric-${metric.id}`}
          className="rounded-2xl border border-line bg-white px-5 py-5 shadow-[var(--shadow-card)]"
        >
          <p className="type-meta">{metric.label}</p>
          <p className="mt-3 text-[1.75rem] font-semibold tracking-tight text-ink">{metric.display}</p>
          {metric.hint ? <p className="mt-2 text-xs leading-5 text-slate-400">{metric.hint}</p> : null}
        </article>
      ))}
    </div>
  )
}
