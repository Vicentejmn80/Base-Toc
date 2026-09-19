import { chromium } from 'playwright'
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.FASE16_URL || 'http://localhost:5175'
const OUT = path.resolve('.cursor-fase16-commitments.webm')
const VIDEO_DIR = path.resolve('.cursor-fase16-video')

function isoDaysFromNow(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
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
          { id: 'f5', key: 'monto', label: 'Monto', type: 'number', role: 'amount', unit: 'USD' },
        ],
        records: [],
        goals: [],
        finance: {
          setup: { complete: true, displayCurrency: 'USD', extraCurrencies: [] },
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
        records: [],
        goals: [],
      },
    ],
    activities: [],
    commitments: [
      {
        id: 'cmp_due',
        description: 'Llamar al colegio',
        dueDate: today,
        status: 'pendiente',
        createdAt: now,
      },
    ],
  }
}

async function mockAi(page) {
  await page.route('**/api/ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'new_record',
        values: { descripcion: 'Llamar al colegio', fecha: isoDaysFromNow(0), tipo: 'Gasto' },
      }),
    })
  })
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
    locale: 'es-PE',
    recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  })
  await context.addInitScript((payload) => {
    window.localStorage.setItem('nexora.snapshot.v1', JSON.stringify(payload))
    window.localStorage.setItem('nexora.pwa.install.v1', 'dismissed')
  }, snapshot())

  const page = await context.newPage()
  page.setDefaultTimeout(40_000)
  await mockAi(page)

  console.log('1. mañana pago el gym')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await typeHome(page, 'mañana pago el gym')
  await page.getByTestId('commitment-confirm').waitFor({ timeout: 12_000 })
  await page.waitForTimeout(700)
  await page.getByTestId('commitment-register').click()
  await page.getByTestId('save-reward').waitFor({ timeout: 8_000 })
  await page.waitForTimeout(1400)
  await page.getByRole('button', { name: /cerrar|listo/i }).first().click()
  await page.waitForTimeout(600)

  console.log('2. quiz de matemática')
  await typeHome(page, 'el jueves tengo quiz de matemática')
  await page.getByTestId('commitment-confirm').waitFor({ timeout: 12_000 })
  const quizCopy = await page.getByTestId('commitment-confirm').innerText()
  if (/finanzas/i.test(quizCopy)) throw new Error('Quiz should not force Finanzas')
  await page.waitForTimeout(700)
  await page.getByTestId('commitment-register').click()
  await page.getByTestId('save-reward').waitFor({ timeout: 8_000 })
  await page.waitForTimeout(1400)
  await page.getByRole('button', { name: /cerrar|listo/i }).first().click()
  await page.waitForTimeout(600)

  console.log('3. reprogramar')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('commitments-today').waitFor({ timeout: 10_000 })
  await page.getByTestId('commitment-reschedule').click()
  await page.getByTestId('commitment-reschedule-form').waitFor()
  const next = isoDaysFromNow(3)
  await page.locator('input[type="date"]').fill(next)
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.waitForTimeout(1800)

  const remaining = await page.getByTestId('commitments-today').count()
  if (remaining !== 0) throw new Error('Rescheduled commitment should leave today empty')

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
