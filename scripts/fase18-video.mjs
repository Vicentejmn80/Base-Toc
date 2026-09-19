import { chromium } from 'playwright'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.FASE18_URL || 'http://localhost:5173'
const SECRET = process.env.CRON_SECRET || 'fase18-cron-dev'
const OUT = path.resolve('.cursor-fase18.webm')
const VIDEO_DIR = path.resolve('.cursor-fase18-video')

function rec(workspaceId, values, offset, suffix = '') {
  const created = new Date()
  created.setDate(created.getDate() + offset)
  const fecha = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`
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
          { id: 'f2', key: 'tipo', label: 'Tipo', type: 'select', role: 'category', options: [{ value: 'Gasto', label: 'Gasto' }, { value: 'Ingreso', label: 'Ingreso' }] },
          { id: 'f4', key: 'descripcion', label: 'Descripción', type: 'text', role: 'identifier' },
          { id: 'f5', key: 'monto', label: 'Monto', type: 'number', role: 'amount', unit: 'Bs' },
        ],
        records: [rec('ws_fin', { tipo: 'Gasto', descripcion: 'Supermercado', monto: 40 }, -1)],
        goals: [],
        finance: {
          setup: { complete: true, country: 'Venezuela', displayCurrency: 'VES', extraCurrencies: [] },
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
        records: [rec('ws_run', { distancia: 6 }, -2), rec('ws_run', { distancia: 5 }, 0, 'b')],
        goals: [],
      },
    ],
    activities: [],
    commitments: [],
  }
}

async function typeHome(page, text) {
  const box = page.locator('#nexora-prompt')
  await box.waitFor({ timeout: 10_000 })
  await box.fill(text)
  await box.press('Enter')
}

async function triggerCron(page, at) {
  const response = await page.request.get(`${BASE}/api/cron/push?at=${encodeURIComponent(at)}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`cron ${response.status} ${JSON.stringify(body)}`)
  return body
}

async function main() {
  mkdirSync(VIDEO_DIR, { recursive: true })
  const userData = mkdtempSync(path.join(os.tmpdir(), 'fase18-chrome-'))
  const context = await chromium.launchPersistentContext(userData, {
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    permissions: ['notifications'],
    recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  })
  await context.grantPermissions(['notifications'], { origin: BASE })
  await context.addInitScript((payload) => {
    if (!window.localStorage.getItem('nexora.snapshot.v1')) {
      window.localStorage.setItem('nexora.snapshot.v1', JSON.stringify(payload))
    }
    window.localStorage.setItem('nexora.pwa.install.v1', 'dismissed')
  }, snapshot())

  const page = context.pages()[0] || (await context.newPage())
  page.on('console', (msg) => console.log('browser', msg.type(), msg.text()))
  page.on('pageerror', (error) => console.log('pageerror', error.message))
  page.setDefaultTimeout(40_000)
  await page.goto(BASE, { waitUntil: 'load' })
  console.log('1. permiso después del primer compromiso')
  await page.waitForTimeout(800)
  await typeHome(page, 'hoy tengo que pagar el gym')
  await page.getByTestId('commitment-confirm').waitFor({ timeout: 12_000 })
  await page.waitForTimeout(600)
  await page.getByTestId('commitment-register').click()
  await page.getByTestId('save-reward').waitFor({ timeout: 8_000 })
  await page.waitForTimeout(800)
  await page.getByTestId('push-permission-prompt').waitFor({ timeout: 8_000 })
  const prompt = await page.getByTestId('push-permission-prompt').innerText()
  if (!/compromiso pendiente/i.test(prompt) || !/domingos/i.test(prompt)) {
    throw new Error(`prompt copy wrong: ${prompt}`)
  }
  await page.waitForTimeout(900)
  await page.getByTestId('push-permission-allow').click()
  await page.waitForFunction(() => {
    try {
      const prefs = JSON.parse(window.localStorage.getItem('nexora.push.prefs.v1') || '{}')
      return Boolean(prefs.subscribed)
    } catch {
      return false
    }
  }, null, { timeout: 20_000 })

  const prefs = await page.evaluate(() => JSON.parse(window.localStorage.getItem('nexora.push.prefs.v1') || '{}'))
  if (!prefs.subscribed) throw new Error(`not subscribed: ${JSON.stringify(prefs)}`)
  console.log('   subscribed', prefs.deviceId)
  await page.waitForTimeout(1500)

  console.log('2. push de compromiso de hoy')
  const checkInAt = await page.evaluate(() => {
    const date = new Date()
    date.setHours(20, 5, 0, 0)
    return date.toISOString()
  })
  const daily = await triggerCron(page, checkInAt)
  if (!daily.results?.length) throw new Error(`no daily push: ${JSON.stringify(daily)}`)
  await page.getByTestId('push-banner').waitFor({ timeout: 12_000 })
  const dailyText = await page.getByTestId('push-banner').innerText()
  if (!/gym/i.test(dailyText)) throw new Error(`daily banner ${dailyText}`)
  await page.waitForTimeout(1600)
  await page.getByTestId('push-banner').click()
  await page.waitForTimeout(500)

  console.log('3. resumen semanal')
  const sundayAt = await page.evaluate(() => {
    const date = new Date()
    const add = (7 - date.getDay()) % 7
    date.setDate(date.getDate() + add)
    date.setHours(19, 5, 0, 0)
    return date.toISOString()
  })
  const weekly = await triggerCron(page, sundayAt)
  if (!weekly.results?.some((item) => item.tags?.some((tag) => String(tag).startsWith('weekly:')))) {
    throw new Error(`no weekly push: ${JSON.stringify(weekly)}`)
  }
  await page.getByTestId('push-banner').waitFor({ timeout: 12_000 })
  const weeklyText = await page.getByTestId('push-banner').innerText()
  if (!/semana|áreas|areas/i.test(weeklyText)) throw new Error(`weekly banner ${weeklyText}`)
  await page.waitForTimeout(1600)

  console.log('4. ajustes en Más')
  await page.goto(`${BASE}/more`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('push-settings').waitFor()
  await page.getByTestId('push-hour').selectOption('21')
  await page.waitForTimeout(800)
  await page.getByTestId('push-disable').click()
  await page.waitForTimeout(1200)

  await context.close()
  const videos = readdirSync(VIDEO_DIR).filter((name) => name.endsWith('.webm'))
  if (!videos.length) throw new Error('No se generó video')
  copyFileSync(path.join(VIDEO_DIR, videos[0]), OUT)
  console.log(`\nVideo: ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
