import { useInstallPrompt } from '../pwa/install'
import { PushSettings } from '../push/PushSettings'

export function MorePage() {
  const { canInstall, iosHint, install } = useInstallPrompt()

  return (
    <div className="space-y-5 pb-4">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Nexora</p>
        <h1 className="type-title mt-1">Más</h1>
        <p className="type-meta mt-1">Medición personal, sin ruido.</p>
      </header>

      <section className="rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">App en este dispositivo</p>
            <p className="mt-1 text-sm text-muted">
              Nexora puede instalarse y abrirse a pantalla completa, sin la barra del navegador.
            </p>
          </div>
        </div>
        {canInstall ? (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-3 text-sm font-medium text-white"
          >
            Instalar Nexora
          </button>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {iosHint
              ? 'En iPhone o iPad: toca Compartir y elige Añadir a pantalla de inicio.'
              : 'Si el navegador lo permite, verás la invitación a instalar después de usarla un momento.'}
          </p>
        )}
      </section>

      <PushSettings />

      <section className="rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-ink">Datos</p>
        <p className="mt-1 text-sm text-muted">
          Tus espacios y lo que vas anotando viven en este dispositivo. Sin conexión, la app sigue
          abierta después de la primera visita.
        </p>
      </section>
    </div>
  )
}
