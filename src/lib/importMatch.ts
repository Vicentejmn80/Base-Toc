import type { FieldValue, RecordItem, Workspace } from '../domain/types'
import { fieldByRole } from './schema'
import { recordTitle } from './records'

const PREFIX =
  /^(colegio|escuela|nido|ie|i\.e\.|cep|c\.e\.p\.|institucion educativa|institución educativa)\s+/i

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'al'])

export function foldIdentifier(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, '')
    .trim()
}

export function identifierKey(value: string) {
  return foldIdentifier(value)
    .replace(PREFIX, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(key: string) {
  return key.split(' ').filter((token) => token.length > 2 && !STOP.has(token))
}

export function identifiersMatch(left: string, right: string) {
  const first = identifierKey(left)
  const second = identifierKey(right)
  if (!first || !second) return false
  if (first === second) return true

  const [shorter, longer] = first.length <= second.length ? [first, second] : [second, first]
  if (shorter.length >= 5 && longer.includes(shorter)) return true

  const leftTokens = tokens(first)
  const rightTokens = tokens(second)
  if (!leftTokens.length || !rightTokens.length) return false

  const overlap = leftTokens.filter((token) => rightTokens.includes(token))
  if (!overlap.length) return false

  const subset =
    leftTokens.every((token) => rightTokens.includes(token)) ||
    rightTokens.every((token) => leftTokens.includes(token))
  if (subset) {
    return overlap.some((token) => token.length >= 4) || overlap.join('').length >= 6
  }

  const union = new Set([...leftTokens, ...rightTokens])
  return overlap.length / union.size >= 0.6
}

export function findDuplicateMatch(
  values: Record<string, FieldValue>,
  workspace: Workspace,
): { id: string; title: string } | null {
  const identifier = fieldByRole(workspace, 'identifier')
  if (!identifier) return null
  const proposed = String(values[identifier.key] ?? '').trim()
  if (!proposed) return null

  for (const record of workspace.records) {
    const existing = String(record.values[identifier.key] ?? '').trim()
    if (!existing) continue
    if (identifiersMatch(proposed, existing)) {
      return { id: record.id, title: recordTitle(record, existing, workspace) }
    }
  }
  return null
}

export function existingRecordById(workspace: Workspace, id?: string): RecordItem | undefined {
  if (!id) return undefined
  return workspace.records.find((record) => record.id === id)
}
