import { useMemo, useState } from 'react'
import type { Workspace } from '../../domain/types'
import { cn } from '../../lib/cn'
import { buildActivityHeatmap, heatIntensity } from '../../metrics/heatmap'

const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

function dayLabel(iso: string) {
  const date = new Date(`${iso}T12:00:00`)
  return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' }).format(date)
}

export function ActivityHeatmap({ workspace }: { workspace: Workspace }) {
  const days = useMemo(() => buildActivityHeatmap(workspace), [workspace])
  const latestActive = [...days].reverse().find((day) => day.count > 0)?.date
  const [selected, setSelected] = useState<string | null>(latestActive ?? null)
  const active = days.find((day) => day.date === selected)

  return (
    <section data-testid="activity-heatmap" className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Actividad reciente
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label) => (
          <span key={label} className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            {label}
          </span>
        ))}
        {Array.from({ length: new Date(`${days[0]?.date ?? ''}T12:00:00`).getDay() || 0 }).map((_, index) => (
          <span key={`pad-${index}`} aria-hidden className="aspect-square min-h-8" />
        ))}
        {days.map((day) => {
          const intensity = heatIntensity(day.count)
          return (
            <button
              key={day.date}
              type="button"
              data-testid={`heatmap-day-${day.date}`}
              aria-label={`${dayLabel(day.date)}: ${day.count} registro${day.count === 1 ? '' : 's'}`}
              onClick={() => setSelected(day.date)}
              className={cn(
                'aspect-square min-h-8 rounded-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400',
                intensity === 0 && 'bg-slate-100',
                intensity === 1 && 'bg-indigo-200',
                intensity === 2 && 'bg-violet-400',
                intensity >= 3 && 'bg-[linear-gradient(135deg,#6366f1,#a855f7,#f472b6)]',
                selected === day.date && 'ring-2 ring-ink/70 ring-offset-1',
              )}
            />
          )
        })}
      </div>
      {active ? (
        <div data-testid="heatmap-summary" className="rounded-2xl bg-soft px-3 py-2.5">
          <p className="text-xs font-medium text-muted">{dayLabel(active.date)}</p>
          {active.count === 0 ? (
            <p className="mt-1 text-sm text-ink">Ese día no hubo registros en este espacio.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {active.entries.map((entry) => (
                <li key={entry.id} className="text-sm leading-5 text-ink">
                  {entry.summary}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
