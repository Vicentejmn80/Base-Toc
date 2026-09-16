import { ANALYZE_SYSTEM_PROMPT } from '../prompts.ts'
import { validateAnalysis } from '../validate.ts'
import { HttpError, runValidated, type HistoryTurn } from './shared.ts'

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
