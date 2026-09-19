import { cn } from '../../lib/cn'

export function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const width = 72
  const height = 28
  if (values.length < 2) return <span className={cn('inline-block w-[72px]', className)} />

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 2) + 1
      const y = height - 3 - ((value - min) / span) * (height - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('text-slate-400', className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
