import { postAi } from './aiClient'
import type { ProgressAnalysis } from './analysisPayload'

export function requestProgressAnalysis(
  metricsPayload: unknown,
  signal?: AbortSignal,
): Promise<ProgressAnalysis> {
  return postAi<ProgressAnalysis>('/api/ai/analyze', { metricsPayload }, signal)
}
