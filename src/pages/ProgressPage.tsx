import { useAppStore } from '../state/store'
import {
  buildHomeProgress,
  buildProgressObservations,
  buildWeeklySummary,
} from '../metrics/progress'
import { AreaProgressList } from '../components/progress/AreaProgressList'
import { ProgressCoach } from '../components/progress/ProgressCoach'
import { ProgressInsight } from '../components/progress/ProgressInsight'

export function ProgressPage() {
  const { workspaces } = useAppStore()
  const areas = buildHomeProgress(workspaces)
  const observations = buildProgressObservations(workspaces)

  return (
    <div className="mx-auto w-full max-w-xl space-y-10 pb-6">
      <header className="space-y-2 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Esta semana
        </p>
        <h1 className="type-title">Cómo te fue</h1>
        <p className="text-[17px] leading-7 text-ink">{buildWeeklySummary(workspaces)}</p>
      </header>

      {workspaces.length === 0 ? (
        <p className="text-sm text-muted">Crea un área para ver tu progreso.</p>
      ) : (
        <>
          <ProgressInsight observation={observations} />
          <AreaProgressList areas={areas} />
          <ProgressCoach workspaces={workspaces} />
        </>
      )}
    </div>
  )
}
