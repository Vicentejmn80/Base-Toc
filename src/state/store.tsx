import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type {
  ActivityEvent,
  ActivityType,
  Commitment,
  FieldValue,
  Goal,
  RecordItem,
  Workspace,
} from '../domain/types'
import type { FinanceBook } from '../finance/domain/types'
import { createSeedData } from '../data/seed'
import { localStorageAdapter } from '../persistence/storage'
import { createId } from '../lib/id'
import { recordTitle } from '../lib/records'
import { migrateWorkspaceFields, readSchema } from '../lib/schema'

interface AppState {
  hydrated: boolean
  workspaces: Workspace[]
  activities: ActivityEvent[]
  commitments: Commitment[]
}

type Action =
  | { type: 'hydrate'; workspaces: Workspace[]; activities: ActivityEvent[]; commitments: Commitment[] }
  | { type: 'create_workspace'; workspace: Workspace; message: string }
  | { type: 'update_workspace'; id: string; patch: Partial<Pick<Workspace, 'name' | 'description' | 'icon' | 'color' | 'finance'>> }
  | { type: 'save_finance'; workspaceId: string; book: FinanceBook; message: string }
  | { type: 'set_goal'; workspaceId: string; goal: Goal }
  | { type: 'delete_workspace'; id: string }
  | { type: 'upsert_record'; workspaceId: string; record: RecordItem; activity: ActivityEvent }
  | { type: 'delete_record'; workspaceId: string; recordId: string; activity: ActivityEvent }
  | { type: 'upsert_commitment'; commitment: Commitment }
  | { type: 'patch_commitment'; id: string; patch: Partial<Commitment> }

const initialState: AppState = {
  hydrated: false,
  workspaces: [],
  activities: [],
  commitments: [],
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return {
        hydrated: true,
        workspaces: action.workspaces,
        activities: action.activities,
        commitments: action.commitments,
      }
    case 'create_workspace':
      return {
        ...state,
        workspaces: [action.workspace, ...state.workspaces],
        activities: [activityFrom(action.workspace.id, 'workspace_created', action.message), ...state.activities],
      }
    case 'update_workspace':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.id
            ? { ...workspace, ...action.patch, updatedAt: new Date().toISOString() }
            : workspace,
        ),
        activities: [
          activityFrom(action.id, 'workspace_updated', 'Se actualizó el espacio.'),
          ...state.activities,
        ],
      }
    case 'delete_workspace':
      return {
        ...state,
        workspaces: state.workspaces.filter((workspace) => workspace.id !== action.id),
        activities: state.activities.filter((item) => item.workspaceId !== action.id),
      }
    case 'save_finance':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.workspaceId
            ? migrateWorkspaceFields({
                ...workspace,
                finance: action.book,
                updatedAt: new Date().toISOString(),
              })
            : workspace,
        ),
        activities: [activityFrom(action.workspaceId, 'record_created', action.message), ...state.activities],
      }
    case 'set_goal':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.workspaceId
            ? {
                ...workspace,
                goals: [action.goal],
                updatedAt: new Date().toISOString(),
              }
            : workspace,
        ),
        activities: [
          activityFrom(action.workspaceId, 'workspace_updated', 'Se actualizó la meta del espacio.'),
          ...state.activities,
        ],
      }
    case 'upsert_record':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id !== action.workspaceId) return workspace
          const exists = workspace.records.some((record) => record.id === action.record.id)
          const records = exists
            ? workspace.records.map((record) => (record.id === action.record.id ? action.record : record))
            : [action.record, ...workspace.records]
          return { ...workspace, records, updatedAt: new Date().toISOString() }
        }),
        activities: [action.activity, ...state.activities],
      }
    case 'delete_record':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.workspaceId
            ? {
                ...workspace,
                records: workspace.records.filter((record) => record.id !== action.recordId),
                updatedAt: new Date().toISOString(),
              }
            : workspace,
        ),
        activities: [action.activity, ...state.activities],
      }
    case 'upsert_commitment':
      return {
        ...state,
        commitments: state.commitments.some((item) => item.id === action.commitment.id)
          ? state.commitments.map((item) => (item.id === action.commitment.id ? action.commitment : item))
          : [action.commitment, ...state.commitments],
      }
    case 'patch_commitment':
      return {
        ...state,
        commitments: state.commitments.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      }
    default:
      return state
  }
}

function activityFrom(workspaceId: string, type: ActivityType, message: string, recordId?: string): ActivityEvent {
  return {
    id: createId('act'),
    workspaceId,
    type,
    message,
    createdAt: new Date().toISOString(),
    recordId,
  }
}

interface AppStoreValue extends AppState {
  createWorkspace: (workspace: Workspace) => void
  updateWorkspace: (id: string, patch: Partial<Pick<Workspace, 'name' | 'description' | 'icon' | 'color' | 'finance'>>) => void
  saveFinance: (workspaceId: string, book: FinanceBook, message: string) => void
  setGoal: (workspaceId: string, goal: Goal) => void
  deleteWorkspace: (id: string) => void
  saveRecord: (
    workspaceId: string,
    values: Record<string, FieldValue>,
    existing?: RecordItem,
  ) => RecordItem
  deleteRecord: (workspaceId: string, recordId: string) => void
  getWorkspace: (id: string) => Workspace | undefined
  saveCommitment: (commitment: Commitment) => void
  patchCommitment: (id: string, patch: Partial<Commitment>) => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const stored = localStorageAdapter.load()
    if (stored && stored.workspaces.length > 0) {
      dispatch({
        type: 'hydrate',
        workspaces: stored.workspaces.map(migrateWorkspaceFields),
        activities: stored.activities,
        commitments: stored.commitments ?? [],
      })
      return
    }
    const seed = createSeedData()
    dispatch({
      type: 'hydrate',
      workspaces: seed.workspaces.map(migrateWorkspaceFields),
      activities: seed.activities,
      commitments: [],
    })
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    const snapshot = {
      version: 1,
      workspaces: state.workspaces,
      activities: state.activities,
      commitments: state.commitments,
    }
    localStorageAdapter.save(snapshot)
    const flush = () => localStorageAdapter.save(snapshot)
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [state.hydrated, state.workspaces, state.activities, state.commitments])

  const createWorkspace = useCallback((workspace: Workspace) => {
    dispatch({
      type: 'create_workspace',
      workspace: migrateWorkspaceFields(workspace),
      message: `Se creó el espacio ${workspace.name}.`,
    })
  }, [])

  const updateWorkspace = useCallback((id: string, patch: Partial<Pick<Workspace, 'name' | 'description' | 'icon' | 'color' | 'finance'>>) => {
    dispatch({ type: 'update_workspace', id, patch })
  }, [])

  const saveFinance = useCallback((workspaceId: string, book: FinanceBook, message: string) => {
    dispatch({ type: 'save_finance', workspaceId, book, message })
  }, [])

  const deleteWorkspace = useCallback((id: string) => {
    dispatch({ type: 'delete_workspace', id })
  }, [])

  const setGoal = useCallback((workspaceId: string, goal: Goal) => {
    dispatch({ type: 'set_goal', workspaceId, goal })
  }, [])

  const saveRecord = useCallback((workspaceId: string, values: Record<string, FieldValue>, existing?: RecordItem) => {
    const now = new Date().toISOString()
    const workspace = state.workspaces.find((item) => item.id === workspaceId)
    const record: RecordItem = existing
      ? { ...existing, values, updatedAt: now }
      : {
          id: createId('rec'),
          workspaceId,
          values,
          createdAt: now,
          updatedAt: now,
        }

    const title = recordTitle(record, 'registro', workspace)
    const statusKey = workspace ? readSchema(workspace).status?.key : 'estado'
    const previousStatus = existing && statusKey ? String(existing.values[statusKey] ?? '') : ''
    const nextStatus = statusKey ? String(values[statusKey] ?? '') : ''
    const noteChanged = existing && String(existing.values.notas ?? existing.values.nota ?? '') !== String(values.notas ?? values.nota ?? '')

    let type: ActivityType = existing ? 'record_updated' : 'record_created'
    let message = existing ? `Se actualizó ${title}.` : `Se agregó ${title}.`
    if (existing && previousStatus && nextStatus && previousStatus !== nextStatus) {
      type = 'status_changed'
      message = `${title} pasó a ${nextStatus}.`
    } else if (existing && noteChanged) {
      type = 'note_updated'
      message = `Se actualizó la nota de ${title}.`
    }

    dispatch({
      type: 'upsert_record',
      workspaceId,
      record,
      activity: activityFrom(workspaceId, type, message, record.id),
    })
    return record
  }, [state.workspaces])

  const deleteRecord = useCallback((workspaceId: string, recordId: string) => {
    const workspace = state.workspaces.find((item) => item.id === workspaceId)
    const record = workspace?.records.find((item) => item.id === recordId)
    const title = recordTitle(record, 'un registro')
    dispatch({
      type: 'delete_record',
      workspaceId,
      recordId,
      activity: activityFrom(workspaceId, 'record_deleted', `Se eliminó ${title}.`, recordId),
    })
  }, [state.workspaces])

  const getWorkspace = useCallback((id: string) => state.workspaces.find((workspace) => workspace.id === id), [state.workspaces])

  const saveCommitment = useCallback((commitment: Commitment) => {
    dispatch({ type: 'upsert_commitment', commitment })
  }, [])

  const patchCommitment = useCallback((id: string, patch: Partial<Commitment>) => {
    dispatch({ type: 'patch_commitment', id, patch })
  }, [])

  const value = useMemo<AppStoreValue>(
    () => ({
      ...state,
      createWorkspace,
      updateWorkspace,
      saveFinance,
      setGoal,
      deleteWorkspace,
      saveRecord,
      deleteRecord,
      getWorkspace,
      saveCommitment,
      patchCommitment,
    }),
    [state, createWorkspace, updateWorkspace, saveFinance, setGoal, deleteWorkspace, saveRecord, deleteRecord, getWorkspace, saveCommitment, patchCommitment],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const value = useContext(AppStoreContext)
  if (!value) throw new Error('useAppStore must be used within AppStoreProvider')
  return value
}
