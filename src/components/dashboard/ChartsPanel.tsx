import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Workspace } from '../../domain/types'
import { computeDistributions, computeTrendSeries } from '../../metrics'
import { EmptyState } from '../ui/EmptyState'

const COLORS = ['#4F46E5', '#0F766E', '#C2410C', '#7C3AED', '#0284C7', '#BE185D', '#334155', '#CA8A04']

export function ChartsPanel({ workspace }: { workspace: Workspace }) {
  const trends = computeTrendSeries(workspace)
  const distributions = computeDistributions(workspace)

  if (workspace.records.length === 0) {
    return (
      <EmptyState
        title="Aún no hay datos para graficar"
        description="Cuando agregues registros, aquí verás evolución y distribución."
      />
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {trends.map((chart) => (
        <article key={chart.title} className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="type-section mb-5">{chart.title}</h3>
          {chart.points.every((point) => point.value === 0) ? (
            <p className="py-10 text-center text-sm text-muted">No hay movimiento en este periodo.</p>
          ) : (
            <div className="h-52 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: '#E2E8F0', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="value" name="Valor" stroke="#4F46E5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      ))}

      {distributions.map((chart) => (
        <article key={chart.title} className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="type-section mb-5">{chart.title}</h3>
          {chart.slices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Sin datos suficientes.</p>
          ) : (
            <div className="flex min-h-56 flex-col items-center gap-4 sm:h-56 sm:flex-row">
              <div className="h-48 w-full sm:h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chart.slices} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2}>
                    {chart.slices.map((slice, index) => (
                      <Cell key={slice.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E2E8F0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-xs text-muted sm:max-w-[180px]">
                {chart.slices.map((slice, index) => (
                  <li key={slice.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                      {slice.name}
                    </span>
                    <span>{slice.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
