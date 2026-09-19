import { Button } from '../ui/Button'

export function SaveReward({
  text,
  onDone,
  compact = false,
}: {
  text: string
  onDone?: () => void
  compact?: boolean
}) {
  return (
    <div
      data-testid="save-reward"
      className={
        compact
          ? 'rounded-2xl border border-emerald-100 bg-success-soft px-4 py-3'
          : 'rounded-2xl border border-emerald-100 bg-success-soft px-4 py-4'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">Listo</p>
      <p className={`mt-1.5 text-ink ${compact ? 'text-sm leading-6' : 'text-[15px] leading-6'}`}>{text}</p>
      {onDone ? (
        <Button className="mt-3 min-h-11" onClick={onDone}>
          Cerrar
        </Button>
      ) : null}
    </div>
  )
}
