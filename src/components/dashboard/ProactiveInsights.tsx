import type { Workspace } from '../../domain/types'
import { buildProgressObservations } from '../../metrics/progress'
import { ProgressInsight } from '../progress/ProgressInsight'

export function ProactiveInsights({ workspace }: { workspace: Workspace }) {
  const lines = buildProgressObservations([workspace])
  if (lines.length === 0) return null
  return <ProgressInsight lines={lines} />
}
