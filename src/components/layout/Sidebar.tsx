import { NavLink, useLocation } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { WorkspaceIcon } from '../ui/WorkspaceIcon'
import { cn } from '../../lib/cn'

export function Sidebar() {
  const { workspaces } = useAppStore()
  const location = useLocation()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-line bg-white/90 px-4 py-5 backdrop-blur">
      <NavLink to="/" className="mb-8 flex items-center gap-2.5 px-2">
        <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-xl" />
        <span className="text-[15px] font-semibold tracking-tight">Nexora</span>
      </NavLink>

      <nav className="space-y-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-soft hover:text-ink',
              isActive && location.pathname === '/' && 'bg-soft text-ink',
            )
          }
        >
          <Home size={16} />
          Hoy
        </NavLink>
      </nav>

      <div className="mt-8 flex-1 overflow-auto scrollbar-thin">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Espacios
        </p>
        <div className="mt-2 space-y-1">
          {workspaces.map((workspace) => (
            <NavLink
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:bg-soft hover:text-ink',
                  isActive && 'bg-soft text-ink',
                )
              }
            >
              <WorkspaceIcon name={workspace.icon} color={workspace.color} size="sm" kind={workspace.kind} />
              <span className="truncate">{workspace.name}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <p className="px-3 pt-4 text-xs text-slate-400">Medición personal, sin ruido.</p>
    </aside>
  )
}
