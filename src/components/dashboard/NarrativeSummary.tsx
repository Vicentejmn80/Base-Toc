import type { Workspace } from '../../domain/types'
import type { PeriodKey } from '../../lib/dates'
import { buildNarrativeSummary } from '../../metrics/narrative'

interface NarrativeSummaryProps {
  workspace: Workspace
  period: PeriodKey
}

export function NarrativeSummary({ workspace, period }: NarrativeSummaryProps) {
  const summary = buildNarrativeSummary(workspace, period)

  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4 shadow-[var(--shadow-card)]">
      <p className="ai-label text-xs font-semibold uppercase tracking-[0.13em]">
        {summary.title}
      </p>
      <div className="mt-2 space-y-1.5">
        {summary.lines.map((line) => (
          <p key={line} className="text-sm leading-6 text-ink">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}
