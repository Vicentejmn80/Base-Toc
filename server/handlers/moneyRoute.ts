import { normalizeName } from './shared.js'
import type { GlobalWorkspaceDef, ModelGlobalCapture } from '../validate.js'

const SPEND_RE = /\b(gaste|pague|pagu[eé]|compr[eé]|pag[oó]|gast[oó]|compr[oó]|cobre|me pagaron)\b/i
const OTHER_ACTIVITY_RE =
  /(corri|kilometr|\bkm\b|paginas?|\blei\b|\bleer\b|habito|medit|entren|gym|pesas|colegio|contacto|cliente|\bmetas?\b|cumpl[ií]|dormi|personal)/i

export function mentionsMoney(message: string) {
  return SPEND_RE.test(normalizeName(message)) || /\$|€|£|\b(usd|eur|usdt|dolares?|euros?)\b/i.test(message)
}

export function isMixedActivityMessage(message: string) {
  const text = normalizeName(message)
  return mentionsMoney(message) && OTHER_ACTIVITY_RE.test(text)
}

export function findFinanceWorkspace(workspaces: GlobalWorkspaceDef[]) {
  return (
    workspaces.find((workspace) => workspace.kind === 'finance') ||
    workspaces.find((workspace) => /finanz|money|gasto/i.test(workspace.name)) ||
    workspaces.find((workspace) =>
      workspace.fields.some((field) => field.role === 'amount' && /monto|amount|precio/i.test(`${field.key} ${field.label}`)),
    )
  )
}

export function findSpecificPayeeWorkspace(
  message: string,
  workspaces: GlobalWorkspaceDef[],
  financeId?: string,
) {
  const text = normalizeName(message)
  return workspaces.find((workspace) => {
    if (workspace.id === financeId) return false
    const name = normalizeName(workspace.name)
    if (name.length < 4 || !text.includes(name)) return false
    return workspace.fields.some((field) => {
      const blob = normalizeName(`${field.key} ${field.label} ${field.role ?? ''}`)
      return field.role === 'amount' || /pago|membres|cuota|precio|monto|fee/.test(blob)
    })
  })
}

export function applyMoneyRouting(
  parsed: ModelGlobalCapture,
  workspaces: GlobalWorkspaceDef[],
  message: string,
): ModelGlobalCapture {
  if (!mentionsMoney(message)) return parsed
  if (isMixedActivityMessage(message)) return parsed

  const finance = findFinanceWorkspace(workspaces)
  if (!finance) return parsed

  const specific = findSpecificPayeeWorkspace(message, workspaces, finance.id)
  if (specific && parsed.kind === 'intents' && parsed.intents.every((intent) => intent.workspaceId === specific.id)) {
    return {
      kind: 'needs_clarification',
      question: `Eso es un pago. ¿Lo anoto en ${finance.name} o en ${specific.name}?`,
    }
  }

  return parsed
}
