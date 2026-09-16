import { Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ProgressAnalysis } from '../../lib/analysisPayload'

interface AnalysisCardProps {
  status: 'idle' | 'loading' | 'error' | 'ready'
  analysis: ProgressAnalysis | null
  errorMessage?: string | null
  onRetry?: () => void
}

export function AnalysisCard({ status, analysis, errorMessage, onRetry }: AnalysisCardProps) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <section className="rounded-2xl border border-line bg-white px-5 py-5 shadow-[var(--shadow-card)]">
        <p className="ai-label text-xs font-semibold uppercase tracking-[0.13em]">Análisis de progreso</p>
        <p className="mt-2 text-sm text-muted">El modelo está leyendo tus métricas ya calculadas. Un momento…</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-soft">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[linear-gradient(90deg,#93c5fd,#818cf8,#c084fc)]" />
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="rounded-2xl border border-danger/20 bg-white px-5 py-5 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-ink">No se pudo analizar el progreso</p>
        <p className="mt-2 text-sm text-danger">{errorMessage || 'La solicitud a la IA falló.'}</p>
        {onRetry ? (
          <Button className="mt-3" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null}
      </section>
    )
  }

  if (!analysis) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="px-5 py-4">
        <p className="ai-label inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em]">
          <Sparkles size={13} />
          Análisis de progreso
        </p>
        <p className="mt-3 text-base leading-7 text-ink">{analysis.resumen}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-success">Fortalezas</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {analysis.fortalezas.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warning">Riesgos</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {analysis.riesgos.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-violet-100 bg-[linear-gradient(135deg,#eef2ff_0%,#fdf4ff_100%)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
          Qué hacer esta semana
        </p>
        <p className="mt-1.5 text-sm font-medium leading-6 text-ink">{analysis.recomendacion}</p>
      </div>
    </section>
  )
}
