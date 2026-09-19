import { cn } from '../../lib/cn'

export function ProgressInsight({
  lines,
  className,
}: {
  lines: string[]
  className?: string
}) {
  if (lines.length === 0) return null

  return (
    <section data-testid="progress-insight" className={cn('space-y-2', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Observación
      </p>
      {lines.map((line) => (
        <p key={line} className="text-[17px] leading-7 text-ink">
          {line}
        </p>
      ))}
    </section>
  )
}
