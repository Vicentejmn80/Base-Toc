import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ToastViewport } from '../ui/ToastViewport'
import { useAppStore } from '../../state/store'
import { cn } from '../../lib/cn'

export function DesktopShell() {
  const { hydrated } = useAppStore()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Sidebar />
      <div className="pl-[260px]">
        <main
          className={cn(
            'min-h-dvh pb-10',
            isHome ? 'pt-0' : 'mx-auto max-w-6xl px-4 pt-5 sm:px-6 lg:pt-8',
          )}
        >
          {hydrated ? (
            <Outlet />
          ) : (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted">
              <div className="h-8 w-8 animate-pulse rounded-full bg-line" />
              Preparando tus espacios...
            </div>
          )}
        </main>
      </div>
      <ToastViewport />
    </div>
  )
}
