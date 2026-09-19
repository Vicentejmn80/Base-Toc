import type { Workspace } from '../domain/types'
import { describeExperiment, type ExperimentFacts } from '../lib/experiments'
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

function hypothesisFor(area: AreaProgress) {
  if (area.weeklyHistory.filter((value) => value > 0).length < 2) {
    return 'Todavía no hay suficientes semanas para una hipótesis.'
  }
  if (area.deltaPercent !== null && Math.abs(area.deltaPercent) >= 20) {
    return 'La diferencia frente a la semana anterior es lo bastante clara como para probar un foco de 7 días.'
  }
  if (area.direction === 'flat') {
    return 'La semana se mantiene cerca de la anterior.'
  }
  return 'Hay un cambio medible respecto de la semana anterior, todavía sin una causa asignada.'
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
    context: `${area.shortDisplay} ${area.periodLabel}. ${area.comparison}.`,
    hypothesis: hypothesisFor(area),
    question: `¿Quieres un experimento de 7 días sobre ${area.workspaceName}?`,
    experiment: {
      descripcion: `Mantener el foco en ${area.workspaceName} durante 7 días y volver a mirar ${area.label}.`,
      metrica_a_revisar: area.label,
    },
    review,
  }
}
