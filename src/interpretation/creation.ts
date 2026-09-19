import type { Workspace, WorkspaceProposal } from '../domain/types'
import { createId } from '../lib/id'
import { genericFields, templates } from '../data/templates'

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function existingByName(workspaces: Workspace[], name: string) {
  return workspaces.find((workspace) => normalize(workspace.name) === normalize(name))
}

const RATIONALE_BY_TEMPLATE = {
  aulasInca: [
    'Incluyo canal y estado porque te permiten ver dónde avanzan o se traban tus contactos.',
    'El próximo seguimiento evita que oportunidades activas se enfríen por falta de recordatorio.',
    'Las notas te dan contexto para retomar cada conversación sin perder continuidad.',
  ],
  finance: [
    'Separar tipo, categoría y monto te deja entender en qué se va el dinero y cuánto entra.',
    'La fecha permite comparar semanas o meses y detectar si tu balance mejora o empeora.',
  ],
  running: [
    'Distancia y duración son la base para medir consistencia y carga semanal.',
    'El ritmo sirve para ver progreso de rendimiento sin depender solo de sensaciones.',
  ],
  habits: [
    'Fecha, hábito y cumplido hacen posible calcular la cobertura semanal y el porcentaje de cumplimiento.',
    'La nota te ayuda a identificar por qué un día salió bien o qué bloqueó el hábito.',
  ],
} as const

export function interpretCreation(prompt: string, workspaces: Workspace[]): WorkspaceProposal {
  const text = normalize(prompt)
  const sourcePrompt = prompt.trim()

  const aulasMatch =
    text.includes('aulas inca') ||
    text.includes('colegio') ||
    text.includes('colegios') ||
    (text.includes('progreso comercial') && text.includes('startup')) ||
    (text.includes('medir') && text.includes('progreso'))

  if (aulasMatch) {
    const template = templates.aulasInca
    const existing = existingByName(workspaces, template.name)
    return {
      name: template.name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      kind: template.kind,
      rationale: [...RATIONALE_BY_TEMPLATE.aulasInca],
      fields: template.fields(),
      records: existing?.records ?? [],
      goals: template.goals(existing?.id ?? 'draft'),
      existingWorkspaceId: existing?.id,
      recognized: true,
      sourcePrompt,
    }
  }

  const financeMatch =
    text.includes('gasto') ||
    text.includes('finanza') ||
    text.includes('ingreso') ||
    text.includes('ahorro') ||
    text.includes('dinero')

  if (financeMatch) {
    const template = templates.finance
    const existing = existingByName(workspaces, template.name)
    return {
      name: template.name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      kind: template.kind,
      rationale: [...RATIONALE_BY_TEMPLATE.finance],
      fields: template.fields(),
      records: existing?.records ?? [],
      goals: template.goals(existing?.id ?? 'draft'),
      existingWorkspaceId: existing?.id,
      recognized: true,
      sourcePrompt,
    }
  }

  const runningMatch =
    text.includes('running') ||
    text.includes('entrenamiento') ||
    text.includes('pesas') ||
    text.includes('correr') ||
    text.includes('kilometro')

  if (runningMatch) {
    const template = templates.running
    const existing = existingByName(workspaces, template.name)
    return {
      name: template.name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      kind: template.kind,
      rationale: [...RATIONALE_BY_TEMPLATE.running],
      fields: template.fields(),
      records: existing?.records ?? [],
      goals: template.goals(existing?.id ?? 'draft'),
      existingWorkspaceId: existing?.id,
      recognized: true,
      sourcePrompt,
    }
  }

  const habitMatch = text.includes('habito') || text.includes('estudio') || text.includes('nutricion')

  if (habitMatch) {
    const template = templates.habits
    const existing = existingByName(workspaces, template.name)
    return {
      name: template.name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      kind: template.kind,
      rationale: [...RATIONALE_BY_TEMPLATE.habits],
      fields: template.fields(),
      records: existing?.records ?? [],
      goals: template.goals(existing?.id ?? 'draft'),
      existingWorkspaceId: existing?.id,
      recognized: true,
      sourcePrompt,
    }
  }

  const guessedName = guessName(prompt) ?? 'Nuevo espacio'

  return {
    name: uniqueName(guessedName, workspaces),
    description: 'Espacio de ejemplo creado a partir de tu instrucción. Aún no hay interpretación automática real.',
    icon: 'layers',
    color: '#334155',
    kind: 'custom',
    rationale: [
      'Empecé con una estructura simple para que puedas registrar avances desde ya.',
      'Cuando tengas más claridad en qué medir, podremos especializar los campos sin rehacer el espacio.',
    ],
    fields: genericFields(),
    records: [],
    goals: [],
    recognized: false,
    sourcePrompt,
  }
}

function guessName(prompt: string) {
  const quoted = prompt.match(/"([^"]+)"/)
  if (quoted?.[1]) return quoted[1].slice(0, 40)
  const para = prompt.match(/para\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s]{2,40})/i)
  if (para?.[1]) return para[1].trim()
  return null
}

function uniqueName(name: string, workspaces: Workspace[]) {
  if (!existingByName(workspaces, name)) return name
  let index = 2
  while (existingByName(workspaces, `${name} (${index})`)) index += 1
  return `${name} (${index})`
}

export function materializeProposal(proposal: WorkspaceProposal): Workspace {
  const id = createId('ws')
  const now = new Date().toISOString()
  return {
    id,
    name: proposal.name,
    description: proposal.description,
    icon: proposal.icon,
    color: proposal.color,
    kind: proposal.kind,
    createdAt: now,
    updatedAt: now,
    fields: proposal.fields.map((field) => ({ ...field, id: createId('field') })),
    records: [],
    goals: proposal.goals.map((goal) => ({ ...goal, id: createId('goal'), workspaceId: id })),
  }
}

export const CREATION_STEPS = [
  { id: 'send', label: 'Enviando tu instrucción' },
  { id: 'model', label: 'El modelo está diseñando el espacio' },
] as const
