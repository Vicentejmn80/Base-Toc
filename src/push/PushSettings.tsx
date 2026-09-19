import { usePush } from './PushProvider'
import { Button } from '../components/ui/Button'

const HOURS = Array.from({ length: 16 }, (_, index) => index + 7)

function hourLabel(hour: number) {
  const suffix = hour < 12 ? 'a.m.' : 'p.m.'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:00 ${suffix}`
}

export function PushSettings() {
  const { supported, prefs, permission, enable, disable, setCheckInHour } = usePush()

  return (
    <section data-testid="push-settings" className="rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-ink">Avisos</p>
      {!supported ? (
        <p className="mt-1 text-sm text-muted">
          Este navegador no puede recibir avisos en segundo plano. En iPhone hace falta instalar la app en la pantalla de inicio.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Solo compromisos del día y un resumen el domingo. Si ignoras 3 avisos seguidos, dejo de mandar uno por
            compromiso y los agrupo; si ignoras 6, me quedo solo con el resumen semanal.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {prefs.enabled && prefs.subscribed ? (
              <Button variant="secondary" onClick={() => void disable()} data-testid="push-disable">
                Desactivar avisos
              </Button>
            ) : permission === 'denied' ? (
              <p className="text-sm text-muted">
                El navegador bloqueó los avisos. Actívalos en la configuración del sitio si cambias de opinión.
              </p>
            ) : (
              <Button onClick={() => void enable()} data-testid="push-enable">
                Activar avisos
              </Button>
            )}
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Hora aproximada del check-in</span>
            <select
              data-testid="push-hour"
              value={prefs.checkInHour}
              onChange={(event) => void setCheckInHour(Number(event.target.value))}
              className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-slate-400"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  )
}
