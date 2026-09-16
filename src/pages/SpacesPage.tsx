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
        <p className="type-meta mt-1">Elige un sistema para continuar.</p>
      </header>
      {workspaces.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Aún no tienes espacios. Créalos desde Inicio.
        </p>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 shadow-[var(--shadow-card)]"
            >
              <WorkspaceIcon name={workspace.icon} color={workspace.color} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{workspace.name}</span>
                <span className="block truncate text-xs text-muted">
                  {workspace.records.length} registros
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
