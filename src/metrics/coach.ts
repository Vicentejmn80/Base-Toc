import type { Workspace } from '../domain/types'
import { describeExperiment, type ExperimentFacts } from '../lib/experiments'
import { formatAmount, formatNumber } from '../lib/format'
import { buildHomeProgress, primaryArea, type AreaProgress } from './progress'

export interface LocalCoach {
  workspaceId: string
  observation: string
  context: string
  hypothesis: string
  question: string
  experiment: {
    descripcion: string
    metrica_a_revisar: string
  }
  review: ExperimentFacts | null
}

function formatAverage(area: AreaProgress) {
  if (area.unit) return formatAmount(area.weeklyAverage, area.unit)
  return `${formatNumber(area.weeklyAverage, 1)} ${area.label}`
}

function hypothesisFor(area: AreaProgress) {
  if (area.weeklyHistory.filter((value) => value > 0).length < 2) {
    return 'Aún no hay semanas suficientes para una hipótesis.'
  }
  if (area.tone === 'steady') {
    return 'Parece que esta semana se mantiene cerca de tu promedio.'
  }
  if (area.direction === 'up' && area.polarity === 'higher_better') {
    return area.kind === 'fitness' || area.label.includes('sesión')
      ? 'Parece que estás aumentando la frecuencia.'
      : 'Parece que el volumen de esta semana quedó por encima de tu promedio.'
  }
  if (area.direction === 'up' && area.polarity === 'lower_better') {
    return 'Parece que este gasto quedó por encima de tu semana anterior.'
  }
  if (area.direction === 'down' && area.polarity === 'higher_better') {
    return 'Parece que esta semana quedó por debajo de tu promedio reciente.'
  }
  if (area.direction === 'down' && area.polarity === 'lower_better') {
    return 'Parece que este gasto quedó por debajo de tu semana anterior.'
  }
  return 'Hay un cambio medible; todavía no alcanza para atribuirle una causa.'
}

function questionFor(area: AreaProgress) {
  if (area.current <= 0) return `¿Quieres registrar algo en ${area.workspaceName} la próxima semana?`
  if (area.kind === 'fitness') {
    return `¿Quieres intentar mantener ${area.shortDisplay} la próxima semana?`
  }
  return `¿Quieres intentar mantener este ritmo en ${area.workspaceName} la próxima semana?`
}

export function buildLocalCoach(workspaces: Workspace[]): LocalCoach | null {
  const areas = buildHomeProgress(workspaces)
  const area = primaryArea(areas)
  if (!area) return null
  const workspace = workspaces.find((item) => item.id === area.workspaceId)
  const review = workspace ? describeExperiment(workspace) : null

  return {
    workspaceId: area.workspaceId,
    observation: area.observation,
    context: `Tu promedio de las últimas 4 semanas es ${formatAverage(area)}.`,
    hypothesis: hypothesisFor(area),
    question: questionFor(area),
    experiment: {
      descripcion: `Mantener el foco en ${area.workspaceName} durante 7 días y volver a mirar ${area.label}.`,
      metrica_a_revisar: area.label,
    },
    review,
  }
}
