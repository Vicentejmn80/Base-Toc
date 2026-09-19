import { ANALYZE_SYSTEM_PROMPT } from '../prompts.js'
import { validateAnalysis } from '../validate.js'
import { HttpError, runValidated, type HistoryTurn } from './shared.js'

export async function handleAnalyze(body: unknown) {
  const payload = body as Record<string, unknown>
  const metricsPayload = payload?.metricsPayload
  if (!metricsPayload || typeof metricsPayload !== 'object') {
    throw new HttpError(400, 'Faltan las métricas calculadas del espacio.')
  }

  const messages: HistoryTurn[] = [
    {
      role: 'user',
      content: `Analiza el progreso de este espacio usando únicamente estas métricas ya calculadas:\n${JSON.stringify(metricsPayload)}`,
    },
  ]

  return runValidated(ANALYZE_SYSTEM_PROMPT, messages, validateAnalysis)
}
