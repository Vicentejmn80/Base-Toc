import { IMPORT_SYSTEM_PROMPT } from '../prompts.js'
import { validateImport } from '../validate.js'
import { readCaptureWorkspace } from './capture.js'
import { HttpError, runValidated, type HistoryTurn } from './shared.js'

export function importSystemPrompt(
  ctx: ReturnType<typeof readCaptureWorkspace>,
  today: string,
) {
  return `${IMPORT_SYSTEM_PROMPT}

Fecha de hoy: ${today}.
Espacio: ${ctx.name} (${ctx.kind}).
Campos:
${ctx.fields
  .map(
    (field) =>
      `- ${field.key} (${field.label}, type ${field.type}${field.role ? `, role ${field.role}` : ''}${field.unit ? `, unit ${field.unit}` : ''}${field.options?.length ? `; opciones EXACTAS: ${field.options.map((option) => option.value).join(' | ')}` : ''})`,
  )
  .join('\n')}
`
}

export async function handleImport(body: unknown) {
  const payload = body as Record<string, unknown>
  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!text) {
    throw new HttpError(400, 'Pega o sube el texto a importar.')
  }

  const ctx = readCaptureWorkspace(payload?.workspace)
  if (!ctx.fields.length) {
    throw new HttpError(400, 'El espacio no tiene campos para importar.')
  }

  const today =
    typeof payload?.today === 'string' ? payload.today : new Date().toISOString().slice(0, 10)
  const system = importSystemPrompt(ctx, today)
  const messages: HistoryTurn[] = [
    {
      role: 'user',
      content: `Importa estas entradas. Devuelve un registro por cada número.\n\n${text}`,
    },
  ]

  return runValidated(system, messages, (value) => validateImport(value, ctx.fields), 45_000)
}
