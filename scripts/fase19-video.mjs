import { chromium } from 'playwright'
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.FASE19_URL || 'http://localhost:5173'
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve('.cursor-fase19.webm')
const VIDEO_DIR = path.resolve('.cursor-fase19-video')
const NOTES = readFileSync(path.join(ROOT, 'fase19-notes.txt'), 'utf8')

const CHANNELS = ['Instagram', 'Correo', 'WhatsApp', 'Llamada', 'Otro'].map((value) => ({ value, label: value }))
const STATUSES = [
  'Por contactar',
  'Contactado',
  'Sin respuesta',
  'Respondió',
  'Reunión acordada',
  'Propuesta enviada',
  'Cliente',
  'No interesado',
].map((value) => ({ value, label: value }))

function rec(values, offset) {
  const created = new Date()
  created.setDate(created.getDate() + offset)
  return {
    id: `rec_${values.colegio.replace(/\s+/g, '_')}`,
    workspaceId: 'ws_crm',
    values,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
  }
}

function snapshot() {
  const now = new Date().toISOString()
  return {
    version: 1,
    workspaces: [
      {
        id: 'ws_crm',
        name: 'Aulas Inca',
        description: 'Seguimiento de colegios',
        icon: 'building',
        color: '#4F46E5',
        kind: 'crm',
        createdAt: now,
        updatedAt: now,
        fields: [
          { id: 'c1', key: 'colegio', label: 'Colegio', type: 'text', role: 'identifier' },
          { id: 'c2', key: 'contacto', label: 'Contacto', type: 'text' },
          { id: 'c3', key: 'canal', label: 'Canal', type: 'select', role: 'category', options: CHANNELS },
          { id: 'c4', key: 'estado', label: 'Estado', type: 'select', role: 'status', options: STATUSES },
          { id: 'c5', key: 'ultimoContacto', label: 'Último contacto', type: 'date', role: 'date' },
          { id: 'c6', key: 'proximoSeguimiento', label: 'Próximo seguimiento', type: 'date' },
          { id: 'c7', key: 'notas', label: 'Notas', type: 'longText' },
        ],
        records: [
          rec({ colegio: 'Colegio San Agustín', canal: 'Correo', estado: 'Reunión acordada' }, -18),
          rec({ colegio: 'Colegio Santa María', canal: 'WhatsApp', estado: 'Respondió' }, -14),
          rec({ colegio: 'Colegio Markham', canal: 'Correo', estado: 'Propuesta enviada' }, -20),
        ],
        goals: [{ id: 'g1', workspaceId: 'ws_crm', label: 'Colegios convertidos', target: 8, unit: 'clientes' }],
      },
    ],
    activities: [],
    commitments: [],
  }
}

function extractColegio(source) {
  const known = [
    [/san jos[eé] de cluny/i, 'San José de Cluny'],
    [/franklin/i, 'Colegio Franklin'],
    [/5099|villa mar[ií]a/i, 'IE 5099 Villa María'],
    [/\bnewton\b/i, 'Newton'],
    [/recoleta/i, 'Recoleta'],
    [/saco oliveros/i, 'Saco Oliveros'],
    [/pit[aá]goras/i, 'Pitágoras'],
    [/san agust/i, 'San Agustín'],
    [/santa mar[ií]a/i, 'Colegio Santa María'],
    [/markham/i, 'Markham'],
    [/[aá]rbol verde/i, 'Nido Árbol Verde'],
    [/santa angela/i, 'CEP Santa Angela'],
    [/alpamayo/i, 'Alpamayo'],
    [/hiram bingham/i, 'Hiram Bingham'],
    [/villa caritas/i, 'Villa Caritas'],
    [/1084|precursores/i, 'IE 1084 Los Precursores'],
    [/trilce/i, 'Trilce Santa Beatriz'],
    [/champagnat/i, 'Champagnat'],
    [/inmaculada/i, 'Colegio de la Inmaculada'],
    [/san antonio de padua/i, 'San Antonio de Padua'],
    [/waldorf/i, 'Waldorf Lima'],
    [/mater purissima/i, 'Mater Purissima'],
    [/juan xxiii/i, 'Juan XXIII Surco'],
    [/montessori/i, 'Montessori Villa'],
    [/euroamerican/i, 'Euroamerican'],
  ]
  for (const [pattern, name] of known) {
    if (pattern.test(source)) return name
  }
  return undefined
}

function parseEntry(source) {
  const review = /el de surco el jueves|el q me pas|^\s*telf\b/i.test(source)
  let canal
  if (/wssp|wspp|\bwsp\b|whatsapp/i.test(source)) canal = 'WhatsApp'
  else if (/instagram|reel/i.test(source)) canal = 'Instagram'
  else if (/correo|mail/i.test(source)) canal = 'Correo'
  else if (/llamada/i.test(source)) canal = 'Llamada'

  let estado
  if (/por contactar/i.test(source)) estado = 'Por contactar'
  else if (/sin respuesta/i.test(source)) estado = 'Sin respuesta'
  else if (/respondi/i.test(source)) estado = 'Respondió'
  else if (/reuni[oó]n acordada/i.test(source)) estado = 'Reunión acordada'
  else if (/propuesta/i.test(source)) estado = 'Propuesta enviada'
  else if (/no tienen presupuesto/i.test(source)) estado = 'No interesado'

  const colegio = extractColegio(source)
  const values = {}
  if (colegio) values.colegio = colegio
  if (canal) values.canal = canal
  if (estado) values.estado = estado
  if (/mar[ií]a \(dir/i.test(source)) values.contacto = 'María'
  if (/secretaria rosa/i.test(source)) values.contacto = 'Rosa'
  if (/innovation lead/i.test(source)) values.contacto = 'Innovation lead'
  if (/head of school/i.test(source)) values.contacto = 'Head of school'

  return {
    source,
    values,
    review: review || !colegio,
    reason: !colegio ? 'No se pudo identificar el colegio' : review ? 'Entrada ambigua' : undefined,
  }
}

function recordCountFromStorage(raw) {
  const parsed = JSON.parse(raw)
  return parsed.workspaces.find((workspace) => workspace.id === 'ws_crm')?.records.length ?? 0
}

async function main() {
  mkdirSync(VIDEO_DIR, { recursive: true })
  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    browser = await chromium.launch({ headless: true, channel: 'chrome' })
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'es-PE',
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
  })
  await context.addInitScript((payload) => {
    window.localStorage.setItem('nexora.snapshot.v1', JSON.stringify(payload))
    window.localStorage.setItem('nexora.pwa.install.v1', 'dismissed')
  }, snapshot())

  const page = await context.newPage()
  page.setDefaultTimeout(40_000)

  await page.route('**/api/ai/import', async (route) => {
    const body = route.request().postDataJSON()
    const text = typeof body?.text === 'string' ? body.text : ''
    const blocks = text
      .split(/\n\s*\n/)
      .map((block) => block.replace(/^\[\d+\]\s*/, '').trim())
      .filter(Boolean)
    await new Promise((resolve) => setTimeout(resolve, 650))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ records: blocks.map(parseEntry) }),
    })
  })

  console.log('1. abrir espacio e Importar')
  await page.goto(`${BASE}/workspaces/ws_crm`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Aulas Inca' }).waitFor()
  await page.waitForTimeout(800)
  const before = recordCountFromStorage(await page.evaluate(() => window.localStorage.getItem('nexora.snapshot.v1')))
  if (before !== 3) throw new Error(`expected 3 seed records, got ${before}`)

  await page.getByTestId('import-open').click()
  await page.getByTestId('import-text').waitFor()
  await page.waitForTimeout(500)

  console.log('2. pegar 28 notas desordenadas')
  await page.getByTestId('import-text').fill(NOTES)
  await page.waitForTimeout(700)
  await page.getByTestId('import-run').click()

  console.log('3. progreso real por lotes')
  await page.getByTestId('import-progress').waitFor()
  const seen = new Set()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const label = (await page.getByTestId('import-progress').count())
      ? await page.getByTestId('import-progress').innerText()
      : ''
    if (label) seen.add(label)
    if (await page.getByTestId('import-summary').count()) break
    await page.waitForTimeout(200)
  }
  const progressLabels = [...seen]
  if (!progressLabels.some((label) => /Procesando \d+ de 28/.test(label))) {
    throw new Error(`progress missing: ${progressLabels.join(' | ')}`)
  }

  console.log('4. revisión, duplicados y editar')
  const summary = await page.getByTestId('import-summary').innerText()
  if (!/\d+ nuevos, \d+ posibles duplicados, \d+ para revisar/.test(summary)) {
    throw new Error(`summary ${summary}`)
  }
  const dupes = await page.getByTestId('import-dupe').count()
  const reviews = await page.getByTestId('import-review').count()
  if (dupes < 3) throw new Error(`expected 3 dupes, got ${dupes}`)
  if (reviews < 2) throw new Error(`expected review rows, got ${reviews}`)
  await page.waitForTimeout(900)
  await page.locator('[data-testid="import-row"][data-dupe="true"]').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)

  const mid = recordCountFromStorage(await page.evaluate(() => window.localStorage.getItem('nexora.snapshot.v1')))
  if (mid !== 3) throw new Error(`records saved before confirm: ${mid}`)

  const newton = page.locator('[data-testid="import-row"]').filter({ hasText: 'Newton' }).first()
  await newton.scrollIntoViewIfNeeded()
  await newton.getByRole('textbox').first().fill('Colegio Newton')
  await page.waitForTimeout(600)

  console.log('5. confirmar e ir a Tabla')
  await page.getByTestId('import-confirm').click()
  await page.waitForTimeout(1200)
  await page.getByPlaceholder('Buscar registros...').waitFor()
  await page.getByPlaceholder('Buscar registros...').fill('Newton')
  await page.getByRole('table').getByText('Colegio Newton').waitFor()
  await page.getByPlaceholder('Buscar registros...').fill('San José')
  await page.getByRole('table').getByText('San José de Cluny').waitFor()
  await page.getByPlaceholder('Buscar registros...').fill('San Agustín')
  const agustinRows = await page.getByRole('table').getByText('San Agustín').count()
  if (agustinRows < 1) throw new Error('missing existing San Agustín')
  await page.waitForTimeout(800)

  const after = recordCountFromStorage(await page.evaluate(() => window.localStorage.getItem('nexora.snapshot.v1')))
  if (after <= before) throw new Error(`records did not increase: ${before} -> ${after}`)
  if (after < 20) throw new Error(`expected 20+ records after import, got ${after}`)

  console.log('6. métricas en Resumen')
  await page.getByRole('button', { name: 'Resumen' }).click()
  await page.waitForTimeout(1400)

  await context.close()
  await browser.close()
  const videos = readdirSync(VIDEO_DIR).filter((name) => name.endsWith('.webm'))
  if (!videos.length) throw new Error('No se generó video')
  copyFileSync(path.join(VIDEO_DIR, videos[0]), OUT)
  console.log(`\nVideo: ${OUT}`)
  console.log(`Records: ${before} -> ${after}. Dupes ${dupes}, review ${reviews}. ${summary}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
