import type { FieldValue, Workspace } from '../domain/types'
import { toIsoDate } from './dates'
import { postAi } from './aiClient'
import {
  requestCapture,
  summarizeFields,
  summarizeRecords,
  type CaptureResult,
} from './captureDialogue'

export interface GlobalCaptureIntent {
  id: string
  workspaceId: string
  workspaceName: string
  capture: CaptureResult
}

export interface GlobalCommitmentDraft {
  description: string
  dueDate: string
  suggestedWorkspaceId?: string
}

export type GlobalCaptureResult =
  | { kind: 'intents'; intents: GlobalCaptureIntent[]; commitments?: GlobalCommitmentDraft[]; createSpace?: { seed: string } }
  | { kind: 'create_space'; seed: string }
  | { kind: 'needs_clarification'; question: string }

export function requestGlobalCapture(
  input: {
    message: string
    workspaces: Workspace[]
    history?: { role: 'user' | 'assistant'; content: string }[]
  },
  signal?: AbortSignal,
) {
  return postAi<GlobalCaptureResult>(
    '/api/ai/capture-global',
    {
      message: input.message,
      today: toIsoDate(),
      history: input.history ?? [],
      workspaces: input.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        kind: workspace.kind,
        fields: summarizeFields(workspace.fields),
        records: summarizeRecords(workspace),
      })),
    },
    signal,
  )
}

export function continueIntentCapture(
  input: {
    message: string
    workspace: Workspace
    history?: { role: 'user' | 'assistant'; content: string }[]
    selectedRecordId?: string
    previousProposal?: {
      kind: 'new_record' | 'update_record'
      recordId?: string
      values: Record<string, FieldValue>
    }
  },
  signal?: AbortSignal,
) {
  return requestCapture(input, signal)
}

export function assistantLineForCapture(result: CaptureResult, workspaceName?: string) {
  if (result.kind === 'needs_clarification' || result.kind === 'needs_disambiguation') {
    return result.question
  }
  if (result.kind === 'new_commitment') return 'Compromiso propuesto'
  if (result.kind === 'update_record') {
    return workspaceName ? `Actualización en ${workspaceName}` : 'Actualización propuesta'
  }
  return workspaceName ? `Anotación en ${workspaceName}` : 'Anotación propuesta'
}
