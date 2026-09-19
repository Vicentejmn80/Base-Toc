import type { Workspace } from '../../domain/types'
import { buildProgressObservations } from '../../metrics/progress'
import { ProgressInsight } from '../progress/ProgressInsight'

export function ProactiveInsights({ workspace }: { workspace: Workspace }) {
  return <ProgressInsight observation={buildProgressObservations([workspace])} />
}
