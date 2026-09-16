import type { Workspace, WorkspaceProposal } from '../domain/types'
import { postAi } from './aiClient'

type DialogueStage = 'idle' | 'awaiting_clarification'

export interface CreationDialogueState {
  stage: DialogueStage
  initialPrompt: string
  askedCount: number
  history: { role: 'user' | 'assistant'; content: string }[]
}

export interface DialogueQuestion {
  role: 'assistant'
  text: string
}

export type DialogueResult =
  | {
      kind: 'ask'
      question: DialogueQuestion
      state: CreationDialogueState
    }
  | {
      kind: 'propose'
      proposal: WorkspaceProposal
      state: CreationDialogueState
    }

export function emptyDialogueState(): CreationDialogueState {
  return { stage: 'idle', initialPrompt: '', askedCount: 0, history: [] }
}

function workspaceSummaries(workspaces: Workspace[]) {
  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    kind: workspace.kind,
    description: workspace.description,
  }))
}

async function requestCreation(
  message: string,
  state: CreationDialogueState,
  workspaces: Workspace[],
  signal?: AbortSignal,
): Promise<DialogueResult> {
  return postAi<DialogueResult>(
    '/api/ai/creation',
    {
      message,
      state,
      existingWorkspaces: workspaceSummaries(workspaces),
    },
    signal,
  )
}

export function startCreationDialogue(
  input: string,
  workspaces: Workspace[],
  signal?: AbortSignal,
): Promise<DialogueResult> {
  return requestCreation(input, emptyDialogueState(), workspaces, signal)
}

export function continueCreationDialogue(
  state: CreationDialogueState,
  reply: string,
  workspaces: Workspace[],
  signal?: AbortSignal,
): Promise<DialogueResult> {
  return requestCreation(reply, state, workspaces, signal)
}
