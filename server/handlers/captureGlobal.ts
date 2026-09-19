import { randomUUID } from 'node:crypto'
import { CAPTURE_GLOBAL_SYSTEM_PROMPT } from '../prompts'
import { validateGlobalCapture, type GlobalWorkspaceDef } from '../validate'
import { finalizeCaptureResult, readCaptureWorkspace } from './capture'
import { applyMoneyRouting } from './moneyRoute'
import { HttpError, isHistoryTurn, runValidated, type HistoryTurn } from './shared'

function readGlobalWorkspaces(raw: unknown): GlobalWorkspaceDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((item) => {
    const ctx = readCaptureWorkspace(item)
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) throw new HttpError(400, 'Cada espacio necesita un id.')
    return {
      id,
      name: ctx.name,
      fields: ctx.fields,
      records: ctx.records,
    }
  })
}

function formatWorkspaceBlock(workspace: GlobalWorkspaceDef) {
  const fields = workspace.fields
    .map((field) => {
      const options = field.options?.length
        ? `; opciones EXACTAS: ${field.options.map((option) => option.value).join(' | ')}`
        : ''
      return `    - ${field.key} (${field.label}, type ${field.type}${field.role ? `, role ${field.role}` : ''}${field.unit ? `, unit ${field.unit}` : ''}${options})`
    })
    .join('\n')
  const records = workspace.records.length
    ? workspace.records
        .slice(0, 25)
        .map((record) => `    - ${record.id} · ${record.title}${record.status ? ` · ${record.status}` : ''}`)
        .join('\n')
    : '    - ninguno'
  return `- id: ${workspace.id}
  nombre: ${workspace.name}
  campos:
${fields}
  registros:
${records}`
}

export async function handleCaptureGlobal(body: unknown) {
  const payload = body as Record<string, unknown>
  const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
  if (!message) {
    throw new HttpError(400, 'Cuéntame qué pasó para poder anotarlo.')
  }

  const workspaces = readGlobalWorkspaces(payload?.workspaces)
  if (workspaces.length === 0) {
    return { kind: 'create_space' as const, seed: message }
  }

  const history = Array.isArray(payload?.history)
    ? payload.history.filter((item: unknown): item is HistoryTurn => isHistoryTurn(item)).slice(-8)
    : []
  const today =
    typeof payload?.today === 'string' ? payload.today : new Date().toISOString().slice(0, 10)

  const system = `${CAPTURE_GLOBAL_SYSTEM_PROMPT}

Fecha de hoy: ${today}.

Espacios del usuario:
${workspaces.map(formatWorkspaceBlock).join('\n\n')}
`

  const messages: HistoryTurn[] = [...history, { role: 'user', content: message }]
  const parsed = applyMoneyRouting(
    await runValidated(
      system,
      messages,
      (value) => validateGlobalCapture(value, workspaces, message),
      22_000,
    ),
    workspaces,
    message,
  )

  if (parsed.kind !== 'intents') return parsed

  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  return {
    kind: 'intents' as const,
    createSpace: parsed.createSpace,
    intents: parsed.intents.map((intent) => {
      const workspace = byId.get(intent.workspaceId)
      const capture = workspace
        ? finalizeCaptureResult(intent.capture, {
            message,
            records: workspace.records,
          })
        : intent.capture
      return {
        id: `intent_${randomUUID()}`,
        workspaceId: intent.workspaceId,
        workspaceName: workspace?.name ?? 'espacio',
        capture,
      }
    }),
  }
}
