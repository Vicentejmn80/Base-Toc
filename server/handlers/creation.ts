import { CREATION_SYSTEM_PROMPT } from '../prompts'
import { validateCreation } from '../validate'
import {
  HttpError,
  hydrateProposal,
  idleState,
  isHistoryTurn,
  runValidated,
  type DialogueState,
  type ExistingWorkspace,
  type HistoryTurn,
} from './shared'

export async function handleCreation(body: unknown) {
  const payload = body as Record<string, unknown>
  const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
  if (!message) {
    throw new HttpError(400, 'Escribe qué quieres crear o medir.')
  }

  const incoming = payload?.state as Partial<DialogueState> | undefined
  const history = Array.isArray(incoming?.history)
    ? incoming.history.filter((item): item is HistoryTurn => isHistoryTurn(item)).slice(-8)
    : []
  const askedCount = typeof incoming?.askedCount === 'number' ? incoming.askedCount : 0
  const initialPrompt =
    typeof incoming?.initialPrompt === 'string' && incoming.initialPrompt.trim()
      ? incoming.initialPrompt
      : message

  const existingWorkspaces: ExistingWorkspace[] = Array.isArray(payload?.existingWorkspaces)
    ? payload.existingWorkspaces
        .filter((item: unknown): item is ExistingWorkspace => {
          return (
            typeof item === 'object' &&
            item !== null &&
            typeof (item as ExistingWorkspace).id === 'string' &&
            typeof (item as ExistingWorkspace).name === 'string'
          )
        })
        .map((item: ExistingWorkspace) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          description: item.description,
        }))
    : []

  const mustPropose = askedCount >= 2
  const system = `${CREATION_SYSTEM_PROMPT}

Espacios que el usuario ya tiene (no dupliques el nombre si es el mismo sistema):
${existingWorkspaces.length ? existingWorkspaces.map((item) => `- ${item.name}`).join('\n') : '- ninguno'}

Preguntas ya hechas en este diálogo: ${askedCount}.
${mustPropose ? 'Ya preguntaste suficiente. Debes devolver kind "propose".' : ''}
`

  const messages: HistoryTurn[] = [...history, { role: 'user', content: message }]

  const parsed = await runValidated(system, messages, validateCreation)
  if (parsed.kind === 'ask') {
    if (mustPropose) {
      throw new HttpError(502, 'El modelo no pudo proponer una estructura válida. Inténtalo de nuevo.')
    }
    const nextHistory: HistoryTurn[] = [...messages, { role: 'assistant', content: parsed.question }]
    return {
      kind: 'ask',
      question: { role: 'assistant', text: parsed.question },
      state: {
        stage: 'awaiting_clarification',
        initialPrompt,
        askedCount: askedCount + 1,
        history: nextHistory,
      },
    }
  }

  return {
    kind: 'propose',
    proposal: hydrateProposal(
      parsed.proposal,
      initialPrompt && initialPrompt !== message ? `${initialPrompt} ${message}`.trim() : message,
      existingWorkspaces,
    ),
    state: idleState(),
  }
}
