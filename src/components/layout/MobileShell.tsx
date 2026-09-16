import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { MobileTabBar } from './MobileTabBar'
import { InstallBanner } from './InstallBanner'
import { ToastViewport } from '../ui/ToastViewport'
import { useAppStore } from '../../state/store'
import { cn } from '../../lib/cn'

export function MobileShell() {
  const { hydrated } = useAppStore()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <main
        className={cn(
          'flex-1',
          isHome
            ? 'pt-0'
            : 'mx-auto w-full max-w-6xl px-4 pt-[max(0.85rem,env(safe-area-inset-top))]',
          'pb-[calc(5.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        {hydrated ? (
          <div key={pathname} className="animate-fade-up">
            <Outlet />
          </div>
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted">
            <div className="h-8 w-8 animate-pulse rounded-full bg-line" />
            Preparando tus espacios...
          </div>
        )}
      </main>
      <InstallBanner />
      <MobileTabBar />
      <ToastViewport />
    </div>
  )
}
