import type { CommandResult, FieldValue, Workspace } from '../domain/types'
import { createId } from '../lib/id'
import { formatAmount, formatNumber } from '../lib/format'
import { readSchema } from '../lib/schema'
import { formatDate, isWithinDays, parseDate } from '../lib/dates'
import { computeMetrics } from '../metrics'

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function text(value: FieldValue) {
  return typeof value === 'string' ? value : ''
}

function num(value: FieldValue) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function matchAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle))
}

function unanswered(workspace: Workspace) {
  return workspace.records.filter((record) =>
    ['Por contactar', 'Contactado', 'Sin respuesta'].includes(text(record.values.estado)),
  )
}

export const SUGGESTED_COMMANDS: Record<Workspace['kind'], string[]> = {
  crm: [
    '¿Cuántos colegios no me han respondido?',
    '¿Qué colegios debo contactar esta semana?',
    '¿Cuál es mi tasa de respuesta?',
    '¿Cuántas reuniones tengo pendientes?',
  ],
  finance: [
    '¿Cuál es mi balance?',
    '¿Cuánto gasté este mes?',
    '¿Cuáles son mis ingresos?',
  ],
  fitness: [
    '¿Cuántos kilómetros llevo?',
    '¿Cuál es mi ritmo promedio?',
    '¿Cuántas sesiones registré?',
  ],
  habits: [
    '¿Cuál es mi racha actual?',
    '¿Qué porcentaje cumplí?',
    '¿Cuántos días cumplí?',
  ],
  custom: ['¿Cuántos registros tengo?', '¿Qué hay pendiente?'],
}

export function runCommand(question: string, workspace: Workspace): CommandResult {
  const q = normalize(question)
  const metrics = computeMetrics(workspace)

  if (workspace.kind === 'crm') {
    if (matchAny(q, ['no me han respondido', 'sin respuesta', 'no respondieron'])) {
      const rows = unanswered(workspace)
      return ok(
        question,
        rows.length === 0
          ? 'Ningún colegio está sin respuesta ahora mismo.'
          : `Tienes ${rows.length} colegios sin una respuesta clara: ${rows.map((r) => text(r.values.colegio)).join(', ')}.`,
      )
    }
    if (matchAny(q, ['esta semana', 'debo contactar', 'seguimiento'])) {
      const rows = workspace.records.filter((record) => isWithinDays(record.values.proximoSeguimiento, 7))
      return ok(
        question,
        rows.length === 0
          ? 'No hay colegios con seguimiento programado para esta semana.'
          : `Esta semana debes contactar ${rows.length}: ${rows
              .map((r) => `${text(r.values.colegio)} (${formatDate(r.values.proximoSeguimiento)})`)
              .join(', ')}.`,
      )
    }
    if (matchAny(q, ['tasa de respuesta', 'tasa'])) {
      const replies = metrics.find((m) => m.id === 'replies')
      return ok(question, replies?.hint ?? 'Aún no hay suficientes datos para calcular la tasa de respuesta.')
    }
    if (matchAny(q, ['reuniones', 'reunion'])) {
      const pending = workspace.records.filter((r) => text(r.values.estado) === 'Reunión acordada')
      return ok(
        question,
        pending.length === 0
          ? 'No tienes reuniones acordadas pendientes.'
          : `Tienes ${pending.length} reunión${pending.length === 1 ? '' : 'es'} acordada${pending.length === 1 ? '' : 's'}: ${pending
              .map((r) => text(r.values.colegio))
              .join(', ')}.`,
      )
    }
  }

  if (workspace.kind === 'finance') {
    if (matchAny(q, ['balance'])) {
      return ok(question, `Tu balance actual es ${metrics.find((m) => m.id === 'balance')?.display ?? '—'}.`)
    }
    if (matchAny(q, ['gaste', 'gastos'])) {
      const now = new Date()
      const monthExpense = workspace.records
        .filter((r) => {
          const date = parseDate(r.values.fecha)
          return r.values.tipo === 'Gasto' && date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        })
        .reduce((sum, r) => sum + num(r.values.monto), 0)
      const unit = readSchema(workspace).amount?.unit
      return ok(question, `Este mes registraste ${formatAmount(monthExpense, unit)} en gastos.`)
    }
    if (matchAny(q, ['ingreso'])) {
      return ok(question, `Tus ingresos acumulados son ${metrics.find((m) => m.id === 'income')?.display ?? '—'}.`)
    }
  }

  if (workspace.kind === 'fitness') {
    if (matchAny(q, ['kilometro', 'km'])) {
      return ok(question, `Llevas ${metrics.find((m) => m.id === 'distance')?.display ?? '0 km'} acumulados.`)
    }
    if (matchAny(q, ['ritmo'])) {
      return ok(question, `Tu ritmo promedio es ${metrics.find((m) => m.id === 'pace')?.display ?? '—'}.`)
    }
    if (matchAny(q, ['sesion'])) {
      return ok(question, `Registraste ${formatNumber(workspace.records.length)} sesiones.`)
    }
  }

  if (workspace.kind === 'habits') {
    if (matchAny(q, ['racha'])) {
      return ok(question, `Tu racha actual es ${metrics.find((m) => m.id === 'streak')?.display ?? '0 días'}.`)
    }
    if (matchAny(q, ['porcentaje', 'cumpl'])) {
      return ok(question, `Tu cumplimiento es ${metrics.find((m) => m.id === 'rate')?.display ?? '0%'}.`)
    }
    if (matchAny(q, ['dias'])) {
      return ok(question, `Has marcado ${metrics.find((m) => m.id === 'done')?.display ?? '0'} cumplimientos.`)
    }
  }

  if (matchAny(q, ['cuantos registros', 'cuantos tengo', 'total'])) {
    return ok(question, `Este espacio tiene ${formatNumber(workspace.records.length)} registros.`)
  }

  if (matchAny(q, ['pendiente'])) {
    const pending = workspace.records.filter((r) => {
      const estado = text(r.values.estado)
      return estado === 'Pendiente' || estado === 'Por contactar' || estado === 'En curso'
    })
    return ok(
      question,
      pending.length === 0
        ? 'No hay registros marcados como pendientes.'
        : `Hay ${pending.length} registros pendientes.`,
    )
  }

  return {
    id: createId('cmd'),
    question,
    answer:
      'Esta versión solo responde comandos predefinidos con datos locales. Esa pregunta todavía no está mapeada, así que no invento una cifra.',
    matched: false,
  }
}

function ok(question: string, answer: string): CommandResult {
  return { id: createId('cmd'), question, answer, matched: true }
}
