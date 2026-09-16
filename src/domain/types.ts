export type FieldType = 'text' | 'longText' | 'number' | 'date' | 'select' | 'boolean'
export type FieldRole = 'amount' | 'date' | 'status' | 'category' | 'identifier' | 'boolean_goal'
// Reserved for later phases: relation | formula | file | tags | computed

export type WorkspaceKind = 'crm' | 'finance' | 'fitness' | 'habits' | 'custom'

export type FieldValue = string | number | boolean | null

export interface FieldOption {
  value: string
  label: string
}

export interface Field {
  id: string
  key: string
  label: string
  type: FieldType
  role?: FieldRole
  unit?: string
  required?: boolean
  options?: FieldOption[]
  placeholder?: string
}

export interface RecordItem {
  id: string
  workspaceId: string
  values: Record<string, FieldValue>
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  workspaceId: string
  label: string
  target: number
  deadline?: string
  unit?: string
}

export type ActivityType =
  | 'workspace_created'
  | 'workspace_updated'
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'status_changed'
  | 'note_updated'

export interface ActivityEvent {
  id: string
  workspaceId: string
  type: ActivityType
  message: string
  createdAt: string
  recordId?: string
}

export interface Workspace {
  id: string
  name: string
  description: string
  icon: string
  color: string
  kind: WorkspaceKind
  createdAt: string
  updatedAt: string
  fields: Field[]
  records: RecordItem[]
  goals: Goal[]
}

export interface ComputedMetric {
  id: string
  label: string
  value: number
  display: string
  hint?: string
}

export interface ChartPoint {
  label: string
  value: number
}

export interface ChartSlice {
  name: string
  value: number
}

export interface WorkspaceProposal {
  name: string
  description: string
  icon: string
  color: string
  kind: WorkspaceKind
  rationale: string[]
  fields: Field[]
  records: RecordItem[]
  goals: Goal[]
  existingWorkspaceId?: string
  recognized: boolean
  sourcePrompt: string
}

export interface CommandResult {
  id: string
  question: string
  answer: string
  matched: boolean
}

export interface AppSnapshot {
  version: number
  workspaces: Workspace[]
  activities: ActivityEvent[]
}
