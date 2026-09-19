import { cn } from '../../lib/cn'

function coords(values: number[], width: number, height: number) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  return values.map((value, index) => ({
    x: (index / Math.max(values.length - 1, 1)) * (width - 8) + 4,
    y: height - 5 - ((value - min) / span) * (height - 10),
  }))
}

function smoothPath(values: number[], width: number, height: number) {
  const points = coords(values, width, height)
  if (points.length === 0) return { d: '', last: { x: 0, y: 0 } }
  if (points.length === 1) {
    return { d: `M ${points[0].x} ${points[0].y}`, last: points[0] }
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    const cx = (current.x + next.x) / 2
    d += ` C ${cx.toFixed(1)} ${current.y.toFixed(1)}, ${cx.toFixed(1)} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }
  return { d, last: points[points.length - 1] }
}

export function Sparkline({
  values,
  className,
  showDot = true,
}: {
  values: number[]
  className?: string
  showDot?: boolean
}) {
  const width = 76
  const height = 30
  if (values.length < 2) return <span className={cn('inline-block w-[76px]', className)} />

  const { d, last } = smoothPath(values, width, height)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('progress-spark text-slate-400', className)}
      aria-hidden
    >
      <path
        className="progress-spark-line"
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
      {showDot ? (
        <circle
          className="progress-spark-dot"
          cx={last.x}
          cy={last.y}
          r="2.1"
          fill="currentColor"
        />
      ) : null}
    </svg>
  )
}
