import type { Workspace } from '../../domain/types'
import { buildProactiveInsights } from '../../metrics/insights'

export function ProactiveInsights({ workspace }: { workspace: Workspace }) {
  const insights = buildProactiveInsights(workspace)
  if (insights.length === 0) return null

  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-ink">Vale la pena que sepas esto</p>
      <ul className="mt-2 space-y-2">
        {insights.map((insight) => (
          <li key={insight.id} className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink">
            {insight.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
