import type { FieldValue, Workspace, WorkspaceKind } from '../domain/types'
import { daysFromNow, toIsoDate } from './dates'

export type VoiceScope = WorkspaceKind | 'home' | 'global'

interface VoiceSimulationResult {
  transcript: string
  durationMs: number
}

interface VoiceExtractionResult {
  values: Record<string, FieldValue>
}

const transcripts: Record<VoiceScope, string[]> = {
  home: [
    'Quiero medir el progreso comercial de mi startup y hacer seguimiento de clientes potenciales.',
    'Ayúdame a organizar mis gastos mensuales para entender en qué se me va el dinero.',
    'Quiero registrar mis entrenamientos de running para ver si estoy mejorando mi ritmo.',
    'Necesito un espacio para seguir mis hábitos diarios de estudio y lectura.',
  ],
  global: [
    'Hoy gasté 40 dólares en el mercado.',
    'Hoy gasté 40 dólares en el mercado y contacté al Colegio Newton.',
    'Hoy planté albahaca y tomates en el balcón.',
  ],
  crm: [
    'Contacté al Colegio San José por Instagram, me dijeron que sí les interesa y que les escriba el viernes.',
    'Hablé con el Colegio Trilce por correo, todavía sin respuesta y toca seguimiento el lunes.',
    'Reunión acordada con el Colegio Saco Oliveros vía WhatsApp para la próxima semana.',
    'El Colegio Pamer ya aceptó la propuesta y pasó a cliente.',
  ],
  finance: [
    'Registré un ingreso de 2400 soles por una venta hoy.',
    'Tuve un gasto de 180 soles en alimentación ayer.',
    'Pagué 90 soles en herramientas y lo quiero en categoría herramientas.',
    'Guardé 500 soles de ahorro este mes.',
  ],
  fitness: [
    'Hoy corrí 7.4 kilómetros en 42 minutos y me sentí bien.',
    'Hice una sesión de running de 5 kilómetros en 27 minutos.',
    'Entrené 10 kilómetros en 58 minutos, ritmo constante.',
    'Corrí suave 6 kilómetros en 38 minutos.',
  ],
  habits: [
    'Hoy cumplí el hábito de leer y estudié una hora.',
    'No cumplí meditar hoy, anótalo como no cumplido.',
    'Comí bien y quiero marcar ese hábito como cumplido.',
    'Dormí más de 7 horas, hábito completado.',
  ],
  custom: [
    'Anota que hoy avancé con el proyecto.',
    'Hoy dejé una tarea pendiente para esta semana.',
    'Quiero seguir un tema nuevo a partir de mañana.',
    'Hoy hubo un avance importante, anótalo.',
  ],
}

const cursorByScope = new Map<VoiceScope, number>()

function pickTranscript(scope: VoiceScope) {
  const pool = transcripts[scope]
  const cursor = cursorByScope.get(scope) ?? 0
  cursorByScope.set(scope, (cursor + 1) % pool.length)
  return pool[cursor]
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nextWeekday(name: string) {
  const map: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  }
  const normalized = normalize(name)
  const target = map[normalized]
  if (target === undefined) return null
  const now = new Date()
  const date = new Date(now)
  const diff = (target - now.getDay() + 7) % 7 || 7
  date.setDate(now.getDate() + diff)
  return toIsoDate(date)
}

function parseAmount(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return Number(match[1].replace(',', '.'))
}

function extractCrm(text: string): VoiceExtractionResult | null {
  const raw = normalize(text)
  const colegioMatch = text.match(/colegio\s+([a-zA-ZÀ-ÿ0-9\s]+)/i)
  if (!colegioMatch) return null
  const colegio = colegioMatch[1]
    .split(/por|via|v[ií]a|me dijeron|y\s+que|,|\./i)[0]
    .trim()
  if (!colegio) return null

  const channel = raw.includes('instagram')
    ? 'Instagram'
    : raw.includes('whatsapp')
      ? 'WhatsApp'
      : raw.includes('correo')
        ? 'Correo'
        : raw.includes('llamada')
          ? 'Llamada'
          : 'Otro'

  const estado = raw.includes('cliente')
    ? 'Cliente'
    : raw.includes('reunion')
      ? 'Reunión acordada'
      : raw.includes('interesa') || raw.includes('respond')
        ? 'Respondió'
        : raw.includes('sin respuesta')
          ? 'Sin respuesta'
          : 'Contactado'

  const weekdayMatch = raw.match(
    /\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/,
  )
  const follow = weekdayMatch ? nextWeekday(weekdayMatch[1]) : toIsoDate(daysFromNow(3))

  return {
    values: {
      colegio,
      contacto: '',
      canal: channel,
      estado,
      ultimoContacto: toIsoDate(),
      proximoSeguimiento: follow,
      notas: text,
    },
  }
}

function extractFinance(text: string): VoiceExtractionResult | null {
  const raw = normalize(text)
  const amount = parseAmount(raw)
  if (!amount) return null
  const tipo = raw.includes('ingreso') || raw.includes('venta') ? 'Ingreso' : 'Gasto'
  const categoria = raw.includes('ahorro')
    ? 'Ahorro'
    : raw.includes('aliment')
      ? 'Alimentación'
      : raw.includes('herramient')
        ? 'Herramientas'
        : raw.includes('transporte')
          ? 'Transporte'
          : 'Otro'
  return {
    values: {
      fecha: toIsoDate(),
      tipo,
      categoria,
      descripcion: text,
      monto: amount,
    },
  }
}

function extractFitness(text: string): VoiceExtractionResult | null {
  const raw = normalize(text)
  const distanceMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(km|kilometros?)/)
  const durationMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*min/)
  if (!distanceMatch || !durationMatch) return null
  const distancia = Number(distanceMatch[1].replace(',', '.'))
  const duracion = Number(durationMatch[1].replace(',', '.'))
  if (!distancia || !duracion) return null
  return {
    values: {
      fecha: toIsoDate(),
      distancia,
      duracion,
      ritmo: Number((duracion / distancia).toFixed(2)),
      notas: text,
    },
  }
}

function extractHabits(text: string): VoiceExtractionResult | null {
  const raw = normalize(text)
  const habit = raw.includes('leer')
    ? 'Leer'
    : raw.includes('estudi')
      ? 'Estudiar'
      : raw.includes('meditar')
        ? 'Meditar'
        : raw.includes('dorm')
          ? 'Dormir 7h'
          : raw.includes('com')
            ? 'Comer bien'
            : null
  if (!habit) return null
  const cumplido = !(
    raw.includes('no cumpli') ||
    raw.includes('no cumpl')
  )
  return {
    values: {
      fecha: toIsoDate(),
      habito: habit,
      cumplido,
      nota: text,
    },
  }
}

function extractCustom(text: string): VoiceExtractionResult | null {
  if (!text.trim()) return null
  const raw = normalize(text)
  return {
    values: {
      nombre: text.split(/[.,]/)[0].slice(0, 80),
      estado: raw.includes('hecho')
        ? 'Hecho'
        : raw.includes('curso')
          ? 'En curso'
          : 'Pendiente',
      fecha: toIsoDate(),
      notas: text,
    },
  }
}

export async function simulateVoiceTranscription(
  scope: VoiceScope,
): Promise<VoiceSimulationResult> {
  const durationMs = 2200 + Math.round(Math.random() * 800)
  await new Promise((resolve) => window.setTimeout(resolve, durationMs))
  return {
    transcript: pickTranscript(scope),
    durationMs,
  }
}

export function extractVoiceRecord(
  workspace: Workspace,
  transcript: string,
): VoiceExtractionResult | null {
  if (workspace.kind === 'crm') return extractCrm(transcript)
  if (workspace.kind === 'finance') return extractFinance(transcript)
  if (workspace.kind === 'fitness') return extractFitness(transcript)
  if (workspace.kind === 'habits') return extractHabits(transcript)
  return extractCustom(transcript)
}
