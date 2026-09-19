import type { Field, Goal, WorkspaceKind } from '../domain/types'
import { createId } from '../lib/id'

export const CRM_STATUSES = [
  'Por contactar',
  'Contactado',
  'Sin respuesta',
  'Respondió',
  'Reunión acordada',
  'Propuesta enviada',
  'Cliente',
  'No interesado',
] as const

export const CRM_CHANNELS = ['Instagram', 'Correo', 'WhatsApp', 'Llamada', 'Otro'] as const

export function field(
  key: string,
  label: string,
  type: Field['type'],
  extra: Partial<Field> = {},
): Field {
  return {
    id: createId('field'),
    key,
    label,
    type,
    ...extra,
  }
}

export function aulasIncaFields(): Field[] {
  return [
    field('colegio', 'Colegio', 'text', { required: true, placeholder: 'Nombre del colegio', role: 'identifier' }),
    field('contacto', 'Contacto', 'text', { placeholder: 'Persona o cargo' }),
    field('canal', 'Canal', 'select', {
      required: true,
      role: 'category',
      options: CRM_CHANNELS.map((value) => ({ value, label: value })),
    }),
    field('estado', 'Estado', 'select', {
      required: true,
      role: 'status',
      options: CRM_STATUSES.map((value) => ({ value, label: value })),
    }),
    field('ultimoContacto', 'Último contacto', 'date', { role: 'date' }),
    field('proximoSeguimiento', 'Próximo seguimiento', 'date'),
    field('notas', 'Notas', 'longText', { placeholder: 'Contexto, siguiente paso o observación' }),
  ]
}

export function financeFields(): Field[] {
  return [
    field('fecha', 'Fecha', 'date', { required: true, role: 'date' }),
    field('tipo', 'Tipo de movimiento', 'select', {
      required: true,
      role: 'category',
      options: [
        { value: 'Ingreso', label: 'Ingreso' },
        { value: 'Gasto', label: 'Gasto' },
        { value: 'Transferencia', label: 'Transferencia' },
        { value: 'Conversion', label: 'Conversión' },
        { value: 'Reembolso', label: 'Reembolso' },
        { value: 'Comision', label: 'Comisión' },
        { value: 'Ajuste', label: 'Ajuste' },
        { value: 'Otro', label: 'Otro' },
      ],
    }),
    field('categoria', 'Categoría', 'select', {
      required: true,
      role: 'category',
      options: [
        { value: 'Ventas', label: 'Ventas' },
        { value: 'Servicios', label: 'Servicios' },
        { value: 'Alimentación', label: 'Alimentación' },
        { value: 'Transporte', label: 'Transporte' },
        { value: 'Herramientas', label: 'Herramientas' },
        { value: 'Ahorro', label: 'Ahorro' },
        { value: 'Otro', label: 'Otro' },
      ],
    }),
    field('descripcion', 'Descripción', 'text', { required: true, placeholder: '¿Qué fue este movimiento?', role: 'identifier' }),
    field('monto', 'Monto', 'number', { required: true, placeholder: '0', role: 'amount', unit: 'S/' }),
  ]
}

export function runningFields(): Field[] {
  return [
    field('fecha', 'Fecha', 'date', { required: true, role: 'date' }),
    field('distancia', 'Distancia (km)', 'number', { required: true, placeholder: '5.0', role: 'amount', unit: 'km' }),
    field('duracion', 'Duración (min)', 'number', { required: true, placeholder: '30' }),
    field('ritmo', 'Ritmo (min/km)', 'number', { placeholder: 'Se calcula si lo dejas vacío' }),
    field('notas', 'Notas', 'longText', { placeholder: 'Sensaciones, terreno, clima...' }),
  ]
}

export function habitsFields(): Field[] {
  return [
    field('fecha', 'Fecha', 'date', { required: true, role: 'date' }),
    field('habito', 'Hábito', 'select', {
      required: true,
      role: 'identifier',
      options: [
        { value: 'Leer', label: 'Leer' },
        { value: 'Estudiar', label: 'Estudiar' },
        { value: 'Meditar', label: 'Meditar' },
        { value: 'Dormir 7h', label: 'Dormir 7h' },
        { value: 'Comer bien', label: 'Comer bien' },
      ],
    }),
    field('cumplido', 'Cumplido', 'boolean', { required: true, role: 'boolean_goal' }),
    field('nota', 'Nota', 'longText', { placeholder: 'Qué ocurrió ese día' }),
  ]
}

export function genericFields(): Field[] {
  return [
    field('nombre', 'Nombre', 'text', { required: true, placeholder: 'Título del registro', role: 'identifier' }),
    field('estado', 'Estado', 'select', {
      role: 'status',
      options: [
        { value: 'Pendiente', label: 'Pendiente' },
        { value: 'En curso', label: 'En curso' },
        { value: 'Hecho', label: 'Hecho' },
      ],
    }),
    field('fecha', 'Fecha', 'date', { role: 'date' }),
    field('notas', 'Notas', 'longText'),
  ]
}

export interface WorkspaceTemplate {
  name: string
  description: string
  icon: string
  color: string
  kind: WorkspaceKind
  fields: () => Field[]
  goals: (workspaceId: string) => Goal[]
}

export const templates: Record<string, WorkspaceTemplate> = {
  aulasInca: {
    name: 'Aulas Inca',
    description: 'Seguimiento de colegios y oportunidades comerciales.',
    icon: 'building',
    color: '#4F46E5',
    kind: 'crm',
    fields: aulasIncaFields,
    goals: (workspaceId) => [
      { id: createId('goal'), workspaceId, label: 'Colegios convertidos', target: 8, unit: 'clientes', deadline: '2026-12-15' },
    ],
  },
  finance: {
    name: 'Finanzas personales',
    description: 'Ingresos, gastos y una lectura clara de tu balance.',
    icon: 'wallet',
    color: '#0F766E',
    kind: 'finance',
    fields: financeFields,
    goals: (workspaceId) => [
      { id: createId('goal'), workspaceId, label: 'Ahorro mensual', target: 800, unit: 'S/', deadline: '2026-09-30' },
    ],
  },
  running: {
    name: 'Running',
    description: 'Kilómetros, ritmo y constancia de tus salidas.',
    icon: 'activity',
    color: '#C2410C',
    kind: 'fitness',
    fields: runningFields,
    goals: (workspaceId) => [
      { id: createId('goal'), workspaceId, label: 'Kilómetros por semana', target: 20, unit: 'km', deadline: '2026-09-20' },
    ],
  },
  habits: {
    name: 'Hábitos',
    description: 'Registro diario de lo que quieres sostener.',
    icon: 'sparkles',
    color: '#7C3AED',
    kind: 'habits',
    fields: habitsFields,
    goals: (workspaceId) => [
      { id: createId('goal'), workspaceId, label: 'Cumplimiento semanal', target: 80, unit: '%', deadline: '2026-09-20' },
    ],
  },
}
