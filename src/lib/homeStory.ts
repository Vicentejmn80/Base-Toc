import type { Workspace } from '../domain/types'
import { daysFromNow, parseDate } from './dates'
import { buildNarrativeSummary } from '../metrics/narrative'

export function lastActivityAt(workspace: Workspace) {
  const times = [
    ...workspace.records.map((record) => parseDate(record.updatedAt) ?? parseDate(record.createdAt)),
    parseDate(workspace.updatedAt),
  ].filter((date): date is Date => Boolean(date))
  if (times.length === 0) return null
  return times.reduce((latest, date) => (date > latest ? date : latest))
}

export function workspacesActiveSince(workspaces: Workspace[], since: Date) {
  return workspaces.filter((workspace) => {
    const last = lastActivityAt(workspace)
    return last ? last >= since : false
  })
}

export function buildCrossSpaceHeadline(workspaces: Workspace[]) {
  if (workspaces.length === 0) return 'Todavía no tienes espacios que resumir.'
  const weekAgo = daysFromNow(-7)
  const active = workspacesActiveSince(workspaces, weekAgo)
  if (active.length === 0) {
    return workspaces.length === 1
      ? `Tienes ${workspaces[0].name} listo. Esta semana todavía no hay movimiento.`
      : `Esta semana aún no hay movimiento en tus ${workspaces.length} espacios.`
  }
  if (active.length === workspaces.length) {
    return workspaces.length === 1
      ? `Esta semana avanzaste en ${workspaces[0].name}.`
      : `Esta semana avanzaste en tus ${workspaces.length} espacios.`
  }
  return `Esta semana avanzaste en ${active.length} de tus ${workspaces.length} espacios.`
}

export function mostActiveWorkspace(workspaces: Workspace[]) {
  return [...workspaces].sort((left, right) => {
    const a = lastActivityAt(left)?.getTime() ?? 0
    const b = lastActivityAt(right)?.getTime() ?? 0
    return b - a
  })[0]
}

export function spaceOneLiner(workspace: Workspace) {
  const narrative = buildNarrativeSummary(workspace, '7d')
  return narrative.lines[0]
}
