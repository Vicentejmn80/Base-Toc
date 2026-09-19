import { Link } from 'react-router-dom'
import { useAppStore } from '../state/store'
import { WorkspaceIcon } from '../components/ui/WorkspaceIcon'

export function SpacesPage() {
  const { workspaces } = useAppStore()

  return (
    <div className="space-y-5 pb-4">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Nexora</p>
        <h1 className="type-title mt-1">Espacios</h1>
        <p className="type-meta mt-1">Toca uno para ver cómo vas.</p>
      </header>
      {workspaces.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Aún no tienes espacios. Créalos desde Hoy.
        </p>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
              className="flex min-h-14 items-center gap-3 border-b border-line/70 py-3 last:border-b-0"
            >
              <WorkspaceIcon name={workspace.icon} color={workspace.color} size="md" kind={workspace.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{workspace.name}</span>
                <span className="block truncate text-xs text-muted">
                  {workspace.records.length === 1
                    ? '1 anotación'
                    : `${workspace.records.length} anotaciones`}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
