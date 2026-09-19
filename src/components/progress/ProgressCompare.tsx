import type { AreaProgress, ChangeTone } from '../../metrics/progress'
import { cn } from '../../lib/cn'

export function toneClass(tone: ChangeTone) {
  if (tone === 'grow') return 'text-ink'
  if (tone === 'fresh') return 'text-indigo-600'
  if (tone === 'ease') return 'text-slate-500'
  if (tone === 'quiet') return 'text-slate-400'
  return 'text-muted'
}

export function ProgressCompare({
  area,
  size = 'sm',
}: {
  area: AreaProgress
  size?: 'sm' | 'lg'
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          'font-semibold tracking-tight text-ink',
          size === 'lg' ? 'text-[1.65rem]' : 'text-[15px] leading-6',
        )}
      >
        {area.shortDisplay}{' '}
        <span className={cn('font-normal text-muted', size === 'lg' ? 'text-base' : 'text-[13px]')}>
          {area.periodLabel}
        </span>
      </p>
      {area.absoluteDeltaLabel ? (
        <p className={cn('mt-0.5 text-xs', toneClass(area.tone))}>{area.absoluteDeltaLabel}</p>
      ) : null}
      {area.contextNote ? <p className="mt-0.5 text-xs text-muted">{area.contextNote}</p> : null}
      {area.percentLabel ? <p className="mt-0.5 text-[11px] text-slate-400">{area.percentLabel}</p> : null}
    </div>
  )
}
