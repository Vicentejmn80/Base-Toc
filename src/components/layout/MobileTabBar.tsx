import { NavLink, useLocation } from 'react-router-dom'
import { Home, LayoutGrid, LineChart, Mic, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useGlobalCapture } from '../../state/globalCapture'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home, match: (path: string) => path === '/' },
  { to: '/spaces', label: 'Espacios', icon: LayoutGrid, match: (path: string) => path.startsWith('/spaces') || path.startsWith('/workspaces') },
  { to: '/progress', label: 'Progreso', icon: LineChart, match: (path: string) => path.startsWith('/progress') },
  { to: '/more', label: 'Más', icon: MoreHorizontal, match: (path: string) => path.startsWith('/more') },
] as const

export function MobileTabBar() {
  const location = useLocation()
  const { openCapture } = useGlobalCapture()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1">
        {tabs.slice(0, 2).map((tab) => (
          <TabLink key={tab.to} tab={tab} active={tab.match(location.pathname)} />
        ))}
        <div className="flex flex-col items-center">
          <button
            type="button"
            data-testid="global-capture-fab"
            aria-label="Contar"
            onClick={() => openCapture()}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[var(--shadow-float)]"
          >
            <Mic size={24} />
          </button>
          <span className="pb-1 pt-0.5 text-[11px] font-medium text-ink">Contar</span>
        </div>
        {tabs.slice(2).map((tab) => (
          <TabLink key={tab.to} tab={tab} active={tab.match(location.pathname)} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({
  tab,
  active,
}: {
  tab: (typeof tabs)[number]
  active: boolean
}) {
  const Icon = tab.icon
  return (
    <NavLink
      to={tab.to}
      className={cn(
        'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium text-muted',
        active && 'text-ink',
      )}
    >
      <Icon size={20} />
      {tab.label}
    </NavLink>
  )
}
