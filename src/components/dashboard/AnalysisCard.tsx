import { useState } from 'react'
import { Beaker, HelpCircle, Lightbulb, Search, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ProgressAnalysis } from '../../lib/analysisPayload'
import type { ExperimentFacts } from '../../lib/experiments'
import { formatReviewDate } from '../../lib/experiments'

interface AnalysisCardProps {
  status: 'idle' | 'loading' | 'error' | 'ready'
  analysis: ProgressAnalysis | null
  experiment?: ExperimentFacts | null
  errorMessage?: string | null
  onRetry?: () => void
}

export function AnalysisCard({
  status,
  analysis,
  experiment,
  errorMessage,
  onRetry,
}: AnalysisCardProps) {
  const [reply, setReply] = useState('')
  const [savedReply, setSavedReply] = useState<string | null>(null)

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
    <section data-testid="analysis-card" className="space-y-3">
      <p className="ai-label inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em]">
        <Sparkles size={13} />
        Análisis de progreso
      </p>

      {analysis.revision ? (
        <div
          data-testid="analysis-revision"
          className="rounded-3xl border border-emerald-100 bg-success-soft px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            Resultado del experimento
          </p>
          <p className="mt-1.5 text-sm leading-6 text-ink">{analysis.revision}</p>
        </div>
      ) : null}

      <div className="rounded-3xl border border-line bg-white px-4 py-3.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <Search size={15} />
          Observación
        </p>
        <p data-testid="analysis-observacion" className="mt-2 text-[15px] leading-6 text-ink">
          {analysis.observacion}
        </p>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-amber-50/70 px-4 py-3.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
          <Lightbulb size={15} />
          Hipótesis
        </p>
        <p className="mt-1 text-[11px] font-medium tracking-wide text-amber-800">Posible explicación</p>
        <p className="mt-2 text-[15px] italic leading-6 text-ink/80">{analysis.hipotesis}</p>
      </div>

      <div className="rounded-3xl border border-line bg-white px-4 py-3.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <HelpCircle size={15} />
          Pregunta
        </p>
        <p className="mt-2 text-[15px] leading-6 text-ink">{analysis.pregunta}</p>
        {savedReply ? (
          <p className="mt-2 rounded-xl bg-canvas px-3 py-2 text-sm text-muted">Anoté tu respuesta: “{savedReply}”</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Confirma o corrige, si quieres"
              className="min-h-11 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-slate-400"
            />
            <Button
              variant="secondary"
              disabled={!reply.trim()}
              onClick={() => {
                setSavedReply(reply.trim())
                setReply('')
              }}
            >
              Anotar
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-violet-200 bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_45%,#fdf2f8_100%)] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">Qué hacer esta semana</p>
        <p className="mt-2 text-[15px] font-medium leading-6 text-ink">{analysis.recomendacion}</p>
      </div>

      {analysis.experimento ? (
        <div
          data-testid="analysis-experiment"
          className="rounded-3xl border border-violet-200 bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_45%,#fdf2f8_100%)] px-4 py-4"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            <Beaker size={14} />
            Experimento de 7 días
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-ink">{analysis.experimento.descripcion}</p>
          <p className="mt-1 text-sm text-muted">Vamos a revisar: {analysis.experimento.metrica_a_revisar}.</p>
          {experiment?.reviewAt ? (
            <p className="mt-2 text-xs text-muted">Revisión el {formatReviewDate(experiment.reviewAt)}.</p>
          ) : (
            <p className="mt-2 text-xs text-muted">Quedó guardado. En 7 días lo revisamos con datos reales.</p>
          )}
        </div>
      ) : experiment?.status === 'running' ? (
        <div className="rounded-3xl border border-violet-200 bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_45%,#fdf2f8_100%)] px-4 py-4">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            <Beaker size={14} />
            Experimento en curso
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-ink">{experiment.descripcion}</p>
          <p className="mt-1 text-sm text-muted">
            Revisión el {formatReviewDate(experiment.reviewAt)}
            {experiment.daysLeft ? ` · faltan ${experiment.daysLeft} días` : ''}.
          </p>
        </div>
      ) : null}
    </section>
  )
}
