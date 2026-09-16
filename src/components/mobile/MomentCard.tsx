import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function MomentCard({
  kicker,
  children,
  footer,
  className,
}: {
  kicker?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <article className={cn('rounded-3xl border border-line bg-white px-5 py-4 shadow-[var(--shadow-card)]', className)}>
      {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{kicker}</p> : null}
      <div className={kicker ? 'mt-2' : undefined}>{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </article>
  )
}
