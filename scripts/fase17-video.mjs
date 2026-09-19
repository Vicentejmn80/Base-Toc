import { chromium } from 'playwright'
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.FASE17_URL || 'http://localhost:5173'
const OUT = path.resolve('.cursor-fase17.webm')
const VIDEO_DIR = path.resolve('.cursor-fase17-video')

function isoDaysFromNow(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function rec(workspaceId, values, offset, suffix = '') {
  const created = new Date()
  created.setDate(created.getDate() + offset)
  const fecha = created.toISOString().slice(0, 10)
  return {
    id: `rec_${workspaceId}_${offset}${suffix}`,
    workspaceId,
    values: { fecha, ...values },
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
  }
}

function snapshot() {
  const now = new Date().toISOString()
  const today = isoDaysFromNow(0)
  return {
    version: 1,
    workspaces: [
      {
        id: 'ws_fin',
        name: 'Finanzas personales',
        description: 'Ingresos y gastos',
        icon: 'wallet',
        color: '#0F766E',
        kind: 'finance',
        createdAt: now,
        updatedAt: now,
        fields: [
          { id: 'f1', key: 'fecha', label: 'Fecha', type: 'date', role: 'date' },
          {
            id: 'f2',
            key: 'tipo',
            label: 'Tipo',
            type: 'select',
            role: 'category',
            options: [
              { value: 'Ingreso', label: 'Ingreso' },
              { value: 'Gasto', label: 'Gasto' },
            ],
          },
          { id: 'f3', key: 'categoria', label: 'Categoría', type: 'select', role: 'category', options: [{ value: 'Otro', label: 'Otro' }] },
          { id: 'f4', key: 'descripcion', label: 'Descripción', type: 'text', role: 'identifier' },
          { id: 'f5', key: 'monto', label: 'Monto', type: 'number', role: 'amount', unit: 'S/' },
        ],
        records: [
          rec('ws_fin', { tipo: 'Gasto', categoria: 'Otro', descripcion: 'Supermercado', monto: 40 }, -1),
          rec('ws_fin', { tipo: 'Ingreso', categoria: 'Otro', descripcion: 'Freelance', monto: 200 }, -4),
        ],
        goals: [{ id: 'g1', workspaceId: 'ws_fin', label: 'Ahorro mensual', target: 800, unit: 'S/' }],
        finance: {
          setup: { complete: true, country: 'Venezuela', displayCurrency: 'VES', extraCurrencies: ['USDT'] },
          accounts: [],
          events: [],
          categories: ['other'],
        },
      },
      {
        id: 'ws_run',
        name: 'Running',
        description: 'Kilómetros',
        icon: 'activity',
        color: '#C2410C',
        kind: 'fitness',
        createdAt: now,
        updatedAt: now,
        fields: [
          { id: 'r1', key: 'fecha', label: 'Fecha', type: 'date', role: 'date' },
          { id: 'r2', key: 'distancia', label: 'Distancia (km)', type: 'number', role: 'amount', unit: 'km' },
        ],
        records: [
          rec('ws_run', { distancia: 5 }, 0, 'a'),
          rec('ws_run', { distancia: 3 }, 0, 'b'),
          rec('ws_run', { distancia: 8 }, -1),
          rec('ws_run', { distancia: 6 }, -2, 'a'),
          rec('ws_run', { distancia: 4 }, -2, 'b'),
          rec('ws_run', { distancia: 7 }, -2, 'c'),
          rec('ws_run', { distancia: 5 }, -6),
          rec('ws_run', { distancia: 10 }, -8),
          rec('ws_run', { distancia: 4 }, -13),
          rec('ws_run', { distancia: 9 }, -20),
        ],
        goals: [],
      },
    ],
    activities: [],
    commitments: [
      {
        id: 'cmp_over',
        description: 'Llamar al colegio',
        dueDate: isoDaysFromNow(-2),
        status: 'pendiente',
        createdAt: now,
      },
      {
        id: 'cmp_today',
        description: 'Revisar el presupuesto',
        dueDate: today,
        status: 'pendiente',
        createdAt: now,
      },
    ],
  }
}

async function typeHome(page, text) {
  const box = page.locator('#nexora-prompt')
  await box.waitFor({ timeout: 10_000 })
  await box.fill(text)
  await box.press('Enter')
}

async function main() {
  mkdirSync(VIDEO_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'es-VE',
    recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  })
  await context.addInitScript((payload) => {
    window.localStorage.setItem('nexora.snapshot.v1', JSON.stringify(payload))
    window.localStorage.setItem('nexora.pwa.install.v1', 'dismissed')
  }, snapshot())

  const page = await context.newPage()
  page.setDefaultTimeout(40_000)

  console.log('1. compromiso futuro visible + persistido')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await typeHome(page, 'mañana pago el gym')
  await page.getByTestId('commitment-confirm').waitFor({ timeout: 12_000 })
  await page.waitForTimeout(700)
  await page.getByTestId('commitment-register').click()
  await page.getByTestId('save-reward').waitFor({ timeout: 8_000 })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /cerrar|listo/i }).first().click()
  await page.waitForTimeout(900)

  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('nexora.snapshot.v1')
    return raw ? JSON.parse(raw) : null
  })
  const gym = stored?.commitments?.find((item) => /gym/i.test(item.description || ''))
  if (!gym) throw new Error('El compromiso no quedó en localStorage')
  const tomorrow = isoDaysFromNow(1)
  if (gym.dueDate !== tomorrow) throw new Error(`dueDate ${gym.dueDate} !== ${tomorrow}`)
  console.log(`   saved in localStorage: ${gym.description} @ ${gym.dueDate}`)

  await page.getByTestId('commitments-upcoming').waitFor({ timeout: 8_000 })
  const upcoming = await page.getByTestId('commitments-upcoming').innerText()
  if (!/gym/i.test(upcoming)) throw new Error('El compromiso de mañana no se ve en Próximos')
  await page.getByTestId('commitments-overdue').waitFor()
  await page.getByTestId('commitments-today').waitFor()
  await page.waitForTimeout(1200)

  console.log('2. coach rediseñado')
  await page.getByTestId('progress-coach').scrollIntoViewIfNeeded()
  await page.getByTestId('coach-experiment').waitFor()
  await page.waitForTimeout(1600)

  console.log('3. mapa de calor Running')
  await page.goto(`${BASE}/workspaces/ws_run`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('activity-heatmap').waitFor({ timeout: 10_000 })
  await page.getByTestId('activity-heatmap').scrollIntoViewIfNeeded()
  const busyDay = isoDaysFromNow(-2)
  await page.getByTestId(`heatmap-day-${busyDay}`).click()
  const summary = await page.getByTestId('heatmap-summary').innerText()
  if (!/km|carrera|distancia|running/i.test(summary) && !/\d/.test(summary)) {
    throw new Error(`heatmap summary vacío: ${summary}`)
  }
  await page.waitForTimeout(1600)

  console.log('4. moneda respeta VES/Bs')
  await page.goto(`${BASE}/workspaces/ws_fin`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ver el detalle' }).click()
  const amount = await page.getByTestId('amount-cell').first().innerText()
  if (!/Bs/.test(amount) || /S\//.test(amount)) {
    throw new Error(`amount still wrong: ${amount}`)
  }
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Llenar formulario' }).click()
  await page.getByTestId('amount-unit').waitFor({ timeout: 8_000 })
  const unitLabel = await page.getByTestId('amount-unit').innerText()
  if (!/Bs/.test(unitLabel)) throw new Error(`form unit ${unitLabel}`)
  await page.waitForTimeout(1600)

  await context.close()
  await browser.close()
  const videos = readdirSync(VIDEO_DIR).filter((name) => name.endsWith('.webm'))
  if (!videos.length) throw new Error('No se generó video')
  copyFileSync(path.join(VIDEO_DIR, videos[0]), OUT)
  console.log(`\nVideo: ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
