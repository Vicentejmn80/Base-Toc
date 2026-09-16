import type { ActivityEvent, FieldValue, RecordItem, Workspace } from '../domain/types'
import { createId } from '../lib/id'
import { toIsoDate, daysFromNow } from '../lib/dates'
import { templates } from './templates'

function record(
  workspaceId: string,
  values: Record<string, FieldValue>,
  createdOffsetDays = 0,
): RecordItem {
  const created = daysFromNow(createdOffsetDays)
  return {
    id: createId('rec'),
    workspaceId,
    values,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
  }
}

export function createSeedData() {
  const aulasId = createId('ws')
  const financeId = createId('ws')
  const runningId = createId('ws')
  const habitsId = createId('ws')

  const aulas: Workspace = {
    id: aulasId,
    name: templates.aulasInca.name,
    description: templates.aulasInca.description,
    icon: templates.aulasInca.icon,
    color: templates.aulasInca.color,
    kind: templates.aulasInca.kind,
    createdAt: daysFromNow(-40).toISOString(),
    updatedAt: new Date().toISOString(),
    fields: templates.aulasInca.fields(),
    goals: templates.aulasInca.goals(aulasId),
    records: [
      record(aulasId, {
        colegio: 'Colegio San Agustín',
        contacto: 'Coordinación académica',
        canal: 'Correo',
        estado: 'Reunión acordada',
        ultimoContacto: toIsoDate(daysFromNow(-4)),
        proximoSeguimiento: toIsoDate(daysFromNow(2)),
        notas: 'Interesados en piloto de 2 secciones de 5to de secundaria.',
      }, -18),
      record(aulasId, {
        colegio: 'Colegio Santa María',
        contacto: 'Dirección',
        canal: 'WhatsApp',
        estado: 'Respondió',
        ultimoContacto: toIsoDate(daysFromNow(-2)),
        proximoSeguimiento: toIsoDate(daysFromNow(5)),
        notas: 'Pidieron una propuesta de precios para el trimestre.',
      }, -14),
      record(aulasId, {
        colegio: 'IE Melitón Carvajal',
        contacto: 'Subdirección',
        canal: 'Llamada',
        estado: 'Sin respuesta',
        ultimoContacto: toIsoDate(daysFromNow(-9)),
        proximoSeguimiento: toIsoDate(daysFromNow(1)),
        notas: 'Dejé mensaje. Reintentar el martes por la mañana.',
      }, -12),
      record(aulasId, {
        colegio: 'Colegio Markham',
        contacto: 'Innovation lead',
        canal: 'Correo',
        estado: 'Propuesta enviada',
        ultimoContacto: toIsoDate(daysFromNow(-6)),
        proximoSeguimiento: toIsoDate(daysFromNow(4)),
        notas: 'Propuesta enviada. Esperan comité interno.',
      }, -20),
      record(aulasId, {
        colegio: 'Colegio Roosevelt',
        contacto: 'Head of upper school',
        canal: 'Instagram',
        estado: 'Contactado',
        ultimoContacto: toIsoDate(daysFromNow(-3)),
        proximoSeguimiento: toIsoDate(daysFromNow(3)),
        notas: 'Vieron el reel del piloto. Aún no confirman reunión.',
      }, -8),
      record(aulasId, {
        colegio: 'Colegio Reina de los Ángeles',
        contacto: 'Secretaría',
        canal: 'WhatsApp',
        estado: 'Cliente',
        ultimoContacto: toIsoDate(daysFromNow(-1)),
        proximoSeguimiento: toIsoDate(daysFromNow(12)),
        notas: 'Contrato firmado para 40 alumnos. Seguimiento de onboarding.',
      }, -30),
      record(aulasId, {
        colegio: 'IE José Antonio Encinas',
        contacto: 'Director',
        canal: 'Llamada',
        estado: 'Por contactar',
        ultimoContacto: null,
        proximoSeguimiento: toIsoDate(daysFromNow(0)),
        notas: 'Prioridad de esta semana. Referido por Santa María.',
      }, -3),
      record(aulasId, {
        colegio: 'Colegio Pestalozzi',
        contacto: 'Coordinadora de ciencias',
        canal: 'Correo',
        estado: 'No interesado',
        ultimoContacto: toIsoDate(daysFromNow(-16)),
        proximoSeguimiento: null,
        notas: 'Este año no tienen presupuesto. Revisitar en enero.',
      }, -22),
      record(aulasId, {
        colegio: 'Colegio Claretiano',
        contacto: 'Pastoral y convivencia',
        canal: 'Instagram',
        estado: 'Respondió',
        ultimoContacto: toIsoDate(daysFromNow(-5)),
        proximoSeguimiento: toIsoDate(daysFromNow(6)),
        notas: 'Quieren entender si el contenido encaja con su malla.',
      }, -10),
      record(aulasId, {
        colegio: 'Colegio Santa Úrsula',
        contacto: 'Administración',
        canal: 'Correo',
        estado: 'Contactado',
        ultimoContacto: toIsoDate(daysFromNow(-7)),
        proximoSeguimiento: toIsoDate(daysFromNow(2)),
        notas: 'Envíe brochure. Sin respuesta aún del área académica.',
      }, -9),
    ],
  }

  const finance: Workspace = {
    id: financeId,
    name: templates.finance.name,
    description: templates.finance.description,
    icon: templates.finance.icon,
    color: templates.finance.color,
    kind: templates.finance.kind,
    createdAt: daysFromNow(-50).toISOString(),
    updatedAt: new Date().toISOString(),
    fields: templates.finance.fields(),
    goals: templates.finance.goals(financeId),
    records: [
      record(financeId, { fecha: toIsoDate(daysFromNow(-28)), tipo: 'Ingreso', categoria: 'Ventas', descripcion: 'Pago piloto Santa María', monto: 2400 }, -28),
      record(financeId, { fecha: toIsoDate(daysFromNow(-22)), tipo: 'Gasto', categoria: 'Herramientas', descripcion: 'Suscripción de diseño', monto: 120 }, -22),
      record(financeId, { fecha: toIsoDate(daysFromNow(-18)), tipo: 'Gasto', categoria: 'Alimentación', descripcion: 'Almuerzos de la semana', monto: 180 }, -18),
      record(financeId, { fecha: toIsoDate(daysFromNow(-14)), tipo: 'Ingreso', categoria: 'Servicios', descripcion: 'Asesoría puntual', monto: 650 }, -14),
      record(financeId, { fecha: toIsoDate(daysFromNow(-10)), tipo: 'Gasto', categoria: 'Transporte', descripcion: 'Movilidad a reuniones', monto: 75 }, -10),
      record(financeId, { fecha: toIsoDate(daysFromNow(-6)), tipo: 'Gasto', categoria: 'Herramientas', descripcion: 'Dominio y hosting', monto: 90 }, -6),
      record(financeId, { fecha: toIsoDate(daysFromNow(-3)), tipo: 'Ingreso', categoria: 'Ventas', descripcion: 'Adelanto Reina de los Ángeles', monto: 1800 }, -3),
      record(financeId, { fecha: toIsoDate(daysFromNow(-1)), tipo: 'Gasto', categoria: 'Ahorro', descripcion: 'Transferencia a fondo de reserva', monto: 500 }, -1),
    ],
  }

  const running: Workspace = {
    id: runningId,
    name: templates.running.name,
    description: templates.running.description,
    icon: templates.running.icon,
    color: templates.running.color,
    kind: templates.running.kind,
    createdAt: daysFromNow(-35).toISOString(),
    updatedAt: new Date().toISOString(),
    fields: templates.running.fields(),
    goals: templates.running.goals(runningId),
    records: [
      record(runningId, { fecha: toIsoDate(daysFromNow(-20)), distancia: 6.2, duracion: 38, ritmo: 6.1, notas: 'Trote suave en el malecón.' }, -20),
      record(runningId, { fecha: toIsoDate(daysFromNow(-16)), distancia: 8, duracion: 47, ritmo: 5.9, notas: 'Mejor respiración en la segunda mitad.' }, -16),
      record(runningId, { fecha: toIsoDate(daysFromNow(-12)), distancia: 5, duracion: 27, ritmo: 5.4, notas: 'Series cortas. Piernas pesadas.' }, -12),
      record(runningId, { fecha: toIsoDate(daysFromNow(-7)), distancia: 10.1, duracion: 58, ritmo: 5.7, notas: 'Larga de domingo. Buen cierre.' }, -7),
      record(runningId, { fecha: toIsoDate(daysFromNow(-3)), distancia: 7.4, duracion: 42, ritmo: 5.7, notas: 'Ritmo estable, sin caminar.' }, -3),
    ],
  }

  const habits: Workspace = {
    id: habitsId,
    name: templates.habits.name,
    description: templates.habits.description,
    icon: templates.habits.icon,
    color: templates.habits.color,
    kind: templates.habits.kind,
    createdAt: daysFromNow(-20).toISOString(),
    updatedAt: new Date().toISOString(),
    fields: templates.habits.fields(),
    goals: templates.habits.goals(habitsId),
    records: [
      record(habitsId, { fecha: toIsoDate(daysFromNow(-6)), habito: 'Leer', cumplido: true, nota: '24 páginas de producto.' }, -6),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-6)), habito: 'Estudiar', cumplido: true, nota: 'Una hora de inglés.' }, -6),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-5)), habito: 'Leer', cumplido: true, nota: '' }, -5),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-5)), habito: 'Meditar', cumplido: false, nota: 'Se me pasó por reuniones.' }, -5),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-4)), habito: 'Estudiar', cumplido: true, nota: 'Notas de ventas.' }, -4),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-3)), habito: 'Dormir 7h', cumplido: true, nota: '' }, -3),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-2)), habito: 'Comer bien', cumplido: true, nota: 'Cociné en casa.' }, -2),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-1)), habito: 'Leer', cumplido: true, nota: 'Antes de dormir.' }, -1),
      record(habitsId, { fecha: toIsoDate(daysFromNow(-1)), habito: 'Meditar', cumplido: true, nota: '10 minutos.' }, -1),
    ],
  }

  const activities: ActivityEvent[] = [
    {
      id: createId('act'),
      workspaceId: aulasId,
      type: 'workspace_created',
      message: 'Se creó el espacio Aulas Inca.',
      createdAt: aulas.createdAt,
    },
    {
      id: createId('act'),
      workspaceId: aulasId,
      type: 'record_created',
      message: 'Se agregó Colegio Reina de los Ángeles.',
      createdAt: daysFromNow(-30).toISOString(),
    },
    {
      id: createId('act'),
      workspaceId: aulasId,
      type: 'status_changed',
      message: 'Colegio San Agustín pasó a Reunión acordada.',
      createdAt: daysFromNow(-4).toISOString(),
    },
    {
      id: createId('act'),
      workspaceId: aulasId,
      type: 'note_updated',
      message: 'Se actualizó la nota de Colegio Santa María.',
      createdAt: daysFromNow(-2).toISOString(),
    },
    {
      id: createId('act'),
      workspaceId: financeId,
      type: 'record_created',
      message: 'Se registró un ingreso de S/ 1,800.',
      createdAt: daysFromNow(-3).toISOString(),
    },
    {
      id: createId('act'),
      workspaceId: runningId,
      type: 'record_created',
      message: 'Se registró una salida de 7.4 km.',
      createdAt: daysFromNow(-3).toISOString(),
    },
  ]

  return { workspaces: [aulas, finance, running, habits], activities }
}
