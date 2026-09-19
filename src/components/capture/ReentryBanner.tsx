import { REENTRY_MESSAGE } from '../../metrics/coverage'

export function ReentryBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      data-testid="reentry-banner"
      className={
        compact
          ? 'rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3'
          : 'rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 shadow-[var(--shadow-card)]'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Retomamos desde hoy</p>
      <p className={`mt-1.5 text-ink ${compact ? 'text-sm leading-6' : 'text-[15px] leading-6'}`}>
        {REENTRY_MESSAGE}
      </p>
    </div>
  )
}
