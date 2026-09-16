import type { Field, FieldRole, FieldValue, RecordItem, Workspace } from '../domain/types'

export interface WorkspaceSchema {
  identifier?: Field
  status?: Field
  categories: Field[]
  flowCategory?: Field
  amount?: Field
  date?: Field
  followUpDate?: Field
  booleanGoal?: Field
  duration?: Field
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function num(value: FieldValue) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function text(value: FieldValue) {
  return typeof value === 'string' ? value : ''
}

export function fieldsByRole(workspace: Workspace, role: FieldRole) {
  return workspace.fields.filter((field) => field.role === role)
}

export function fieldByRole(workspace: Workspace, role: FieldRole) {
  return workspace.fields.find((field) => field.role === role)
}

function looksLikeFlow(field: Field) {
  const options = field.options?.map((option) => normalize(option.value)) ?? []
  const hasIncome = options.some((option) => /ingreso|income|venta/.test(option))
  const hasExpense = options.some((option) => /gasto|expense|salida/.test(option))
  return hasIncome && hasExpense
}

function looksLikeFollowUp(field: Field) {
  const blob = `${field.key} ${field.label}`
  return /seguim|vence|follow|due|proximo/.test(normalize(blob))
}

export function readSchema(workspace: Workspace): WorkspaceSchema {
  const identifier = fieldByRole(workspace, 'identifier')
  const status = fieldByRole(workspace, 'status')
  const categories = fieldsByRole(workspace, 'category')
  const amount = fieldByRole(workspace, 'amount')
  const dateFields = fieldsByRole(workspace, 'date')
  const date =
    dateFields.find((field) => !looksLikeFollowUp(field)) ?? dateFields[0]
  const followUpDate =
    workspace.fields.find((field) => field.type === 'date' && looksLikeFollowUp(field) && field.id !== date?.id) ??
    dateFields.find((field) => looksLikeFollowUp(field) && field.id !== date?.id)
  const booleanGoal = fieldByRole(workspace, 'boolean_goal')
  const flowCategory = categories.find(looksLikeFlow)
  const duration = workspace.fields.find((field) => {
    const blob = normalize(`${field.key} ${field.label}`)
    return field.type === 'number' && /duracion|minut|tiempo/.test(blob)
  })

  return {
    identifier,
    status,
    categories,
    flowCategory,
    amount,
    date,
    followUpDate,
    booleanGoal,
    duration,
  }
}

export function recordValue(record: RecordItem, field: Field | undefined) {
  if (!field) return null
  return record.values[field.key] ?? null
}

export function recordNumber(record: RecordItem, field: Field | undefined) {
  return num(recordValue(record, field))
}

export function recordText(record: RecordItem, field: Field | undefined) {
  return text(recordValue(record, field))
}

export function signedAmount(record: RecordItem, schema: WorkspaceSchema) {
  const amount = recordNumber(record, schema.amount)
  if (!schema.flowCategory) return { income: 0, expense: 0, total: amount }
  const kind = normalize(recordText(record, schema.flowCategory))
  if (/gasto|expense|salida/.test(kind)) return { income: 0, expense: amount, total: -amount }
  if (/ingreso|income|venta/.test(kind)) return { income: amount, expense: 0, total: amount }
  return { income: 0, expense: 0, total: amount }
}

export function isSuccessStatus(value: string, status?: Field) {
  const options = status?.options?.map((option) => option.value) ?? []
  const match = options.find((option) =>
    /cliente|ganad|aceptad|cerrado|hecho|aprobad/.test(normalize(option)),
  )
  if (match) return value === match
  return options.length > 0 ? value === options[options.length - 1] : false
}

export function isBacklogStatus(value: string, status?: Field) {
  const first = status?.options?.[0]?.value
  if (first) return value === first
  return /por contactar|pendiente|nuevo/.test(normalize(value))
}

export function isPositiveStatus(value: string, status?: Field) {
  if (isBacklogStatus(value, status)) return false
  if (/no interesado|rechaz|perdid|sin respuesta/.test(normalize(value))) return false
  return /respond|reunion|propuesta|cliente|entrevista|acept|ganad|hecho|curso/.test(normalize(value))
}

export function isMeetingStatus(value: string) {
  return /reunion|propuesta|cliente|entrevista/.test(normalize(value))
}

function inferUnit(field: Field, workspaceKind?: Workspace['kind']) {
  const blob = normalize(`${field.key} ${field.label} ${field.unit ?? ''}`)
  if (field.unit) return field.unit
  if (/km|distancia/.test(blob)) return 'km'
  if (/kg|peso/.test(blob)) return 'kg'
  if (/%|porcentaje/.test(blob)) return '%'
  if (/min|ritmo|pace/.test(blob)) return 'min'
  if (/usd|dolar|\$/.test(blob)) return '$'
  if (/eur|euro/.test(blob)) return '€'
  if (/monto|precio|ingreso|gasto|amount|money/.test(blob) || workspaceKind === 'finance') return 'S/'
  return undefined
}

export function inferFieldRole(field: Field, index: number, fields: Field[], kind?: Workspace['kind']): Field {
  if (field.role && (field.role !== 'amount' || field.unit)) {
    if (field.role === 'amount' && !field.unit) return { ...field, unit: inferUnit(field, kind) }
    return field
  }

  const blob = normalize(`${field.key} ${field.label}`)
  let role: FieldRole | undefined = field.role
  let unit = field.unit

  if (!role && field.type === 'boolean' && /cumpl|hecho|done|completo/.test(blob)) {
    role = 'boolean_goal'
  } else if (!role && field.type === 'select' && /estado|status|etapa|pipeline/.test(blob)) {
    role = 'status'
  } else if (!role && field.type === 'select' && /canal|categoria|tipo|habito|channel|category/.test(blob)) {
    role = /habito/.test(blob) && !fields.some((item) => item.role === 'identifier') ? 'identifier' : 'category'
  } else if (!role && field.type === 'number' && !/ritmo|pace|duracion|minuto/.test(blob)) {
    role = 'amount'
    unit = inferUnit(field, kind)
  } else if (!role && field.type === 'date' && !looksLikeFollowUp(field)) {
    const alreadyHasDate = fields.some((item, itemIndex) => itemIndex < index && item.role === 'date')
    if (!alreadyHasDate) role = 'date'
  } else if (
    !role &&
    (field.type === 'text' || field.type === 'select') &&
    (index === 0 || /colegio|nombre|empresa|habito|descripcion|titulo|cliente/.test(blob))
  ) {
    const alreadyHasIdentifier = fields.some((item) => item.role === 'identifier')
    if (!alreadyHasIdentifier) role = 'identifier'
  }

  if (role === 'amount' && !unit) unit = inferUnit({ ...field, role }, kind)

  return { ...field, role, unit }
}

export function migrateWorkspaceFields(workspace: Workspace): Workspace {
  const needsMigration = workspace.fields.some((field) => {
    if (field.role === 'amount' && !field.unit) return true
    if (field.role) return false
    if (field.type === 'longText') return false
    return true
  })
  if (!needsMigration) return workspace

  const fields: Field[] = []
  for (let index = 0; index < workspace.fields.length; index += 1) {
    fields.push(inferFieldRole(workspace.fields[index], index, [...fields, ...workspace.fields.slice(index)], workspace.kind))
  }

  const goals = workspace.goals.map((goal) => {
    if (goal.unit === 'PEN') return { ...goal, unit: 'S/' }
    const amount = fields.find((field) => field.role === 'amount')
    if (!goal.unit && amount?.unit) return { ...goal, unit: amount.unit }
    return goal
  })

  return { ...workspace, fields, goals }
}

export function captureExample(workspace: Workspace) {
  const schema = readSchema(workspace)
  const identifier = schema.identifier?.label ?? 'el registro'
  if (schema.amount && schema.flowCategory) {
    const sample = schema.flowCategory.options?.find((option) => /ingreso|income/i.test(option.value))?.label ?? 'ingreso'
    const unit = schema.amount.unit ? `${schema.amount.unit} ` : ''
    return `Ej. Registré un ${sample.toLowerCase()} de ${unit}150`
  }
  if (schema.amount) {
    const unit = schema.amount.unit ? ` ${schema.amount.unit}` : ''
    return `Ej. Hoy registré ${schema.amount.label.toLowerCase()} de 8${unit}`
  }
  if (schema.identifier && schema.status) {
    const option =
      schema.status.options?.find((item) => isSuccessStatus(item.value, schema.status))?.label ??
      schema.status.options?.[0]?.label ??
      schema.status.label
    return `Ej. ${identifier} Acme ya es ${option}`
  }
  if (schema.booleanGoal && schema.identifier) {
    return `Ej. Hoy cumplí ${identifier.toLowerCase()} de leer`
  }
  return `Ej. Cuéntame algo de ${workspace.name}`
}

export function recordDateValue(workspace: Workspace, record: RecordItem) {
  const schema = readSchema(workspace)
  const preferred = schema.date ? record.values[schema.date.key] : undefined
  return preferred ?? record.createdAt
}
