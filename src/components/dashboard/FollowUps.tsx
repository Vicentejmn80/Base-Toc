import type { Workspace } from '../../domain/types'
import { upcomingFollowUps } from '../../metrics'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { formatDate } from '../../lib/dates'
import { readSchema, recordText } from '../../lib/schema'
import { recordTitle } from '../../lib/records'

export function FollowUps({ workspace }: { workspace: Workspace }) {
  const schema = readSchema(workspace)
  if (!schema.followUpDate) return null
  const items = upcomingFollowUps(workspace)

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <h3 className="type-section">Próximos seguimientos</h3>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nada pendiente"
            description={`Cuando un registro tenga ${schema.followUpDate.label.toLowerCase()}, aparecerá aquí.`}
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((record) => (
            <li key={record.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div>
                <p className="text-sm font-medium">{recordTitle(record, 'Registro', workspace)}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(record.values[schema.followUpDate!.key])}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {schema.categories[0] ? <Badge>{recordText(record, schema.categories[0]) || '—'}</Badge> : null}
                {schema.status ? <Badge>{recordText(record, schema.status)}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
