import { useInstallPrompt } from '../../pwa/install'

export function InstallBanner() {
  const { visible, canInstall, iosHint, install, dismiss } = useInstallPrompt()
  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 px-4" style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 shadow-[var(--shadow-float)]">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Instalar Nexora</p>
          <p className="text-xs text-muted">
            {iosHint && !canInstall
              ? 'En Safari: Compartir → Añadir a pantalla de inicio.'
              : 'Ábrela como app, a pantalla completa.'}
          </p>
        </div>
        {canInstall ? (
          <button
            type="button"
            onClick={() => void install()}
            className="min-h-11 shrink-0 rounded-xl bg-ink px-3 text-sm font-medium text-white"
          >
            Instalar
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 min-w-11 shrink-0 rounded-xl text-sm text-muted"
          aria-label="Cerrar"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
