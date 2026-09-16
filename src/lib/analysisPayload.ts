import type { Workspace } from '../domain/types'
import type { PeriodKey } from './dates'
import { computeMetrics } from '../metrics'
import { buildNarrativeSummary } from '../metrics/narrative'
import { projectGoal } from '../metrics/goals'
import { buildProactiveInsights } from '../metrics/insights'

export interface ProgressAnalysis {
  resumen: string
  fortalezas: string[]
  riesgos: string[]
  recomendacion: string
}

export function buildAnalysisPayload(workspace: Workspace, period: PeriodKey) {
  const metrics = computeMetrics(workspace)
  const narrative = buildNarrativeSummary(workspace, period)
  const goal = workspace.goals[0] ? projectGoal(workspace, workspace.goals[0]) : null
  const insights = buildProactiveInsights(workspace)

  return {
    workspace: {
      name: workspace.name,
      kind: workspace.kind,
      description: workspace.description,
      recordCount: workspace.records.length,
    },
    period,
    metrics: metrics.map((metric) => ({
      label: metric.label,
      display: metric.display,
      value: metric.value,
      hint: metric.hint,
    })),
    narrative: {
      title: narrative.title,
      lines: narrative.lines,
    },
    goal: goal
      ? {
          label: goal.goal.label,
          current: goal.displayCurrent,
          target: goal.displayTarget,
          progress: Math.round(goal.progress),
          projection: goal.projectionText,
          deadline: goal.goal.deadline ?? null,
        }
      : null,
    insights: insights.map((insight) => insight.text),
  }
}
