import type { ActivityEvent } from '../../domain/types'
import { EmptyState } from '../ui/EmptyState'
import { formatDateTime } from '../../lib/dates'

export function ActivityFeed({ activities }: { activities: ActivityEvent[] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay actividad"
        description="Los cambios de este espacio se irán listando aquí."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {activities.map((activity) => (
        <li key={activity.id} className="rounded-2xl border border-line bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <p className="text-sm">{activity.message}</p>
          <p className="mt-1 text-xs text-muted">{formatDateTime(activity.createdAt)}</p>
        </li>
      ))}
    </ul>
  )
}
