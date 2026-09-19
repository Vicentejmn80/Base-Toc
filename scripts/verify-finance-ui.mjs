import { chromium } from 'playwright'

const BASE = process.env.FINANCE_URL || 'http://127.0.0.1:5175'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.setDefaultTimeout(15000)

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('nexora.snapshot.v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  const financeId = await page.evaluate(() => {
    const raw = localStorage.getItem('nexora.snapshot.v1')
    const parsed = raw ? JSON.parse(raw) : { workspaces: [] }
    return parsed.workspaces.find((item) => item.kind === 'finance')?.id ?? null
  })
  if (!financeId) throw new Error('Seed finance workspace missing')

  await page.goto(`${BASE}/workspaces/${financeId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  if ((await page.locator('[data-testid="finance-onboarding"]').count()) < 1) {
    throw new Error('Expected finance onboarding on first visit')
  }

  await page.getByPlaceholder('País').fill('Perú')
  await page.getByRole('button', { name: 'Seguir' }).click()
  await page.getByPlaceholder('Moneda principal').fill('USD')
  await page.getByRole('button', { name: 'Seguir' }).click()
  await page.getByRole('button', { name: 'Seguir' }).click()
  await page.getByPlaceholder('Nombre de la cuenta o institución').fill('Binance')
  await page.getByRole('button', { name: 'Añadir' }).click()
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.waitForTimeout(400)

  if ((await page.locator('[data-testid="finance-panel"]').count()) < 1) {
    throw new Error('Expected finance panel after onboarding')
  }

  await page.getByRole('button', { name: /Contar/ }).click()
  await page.waitForTimeout(300)
  await page.locator('#nexora-prompt-capture').fill('Me pagaron 50 USDT por Binance.')
  await page.locator('#nexora-prompt-capture').press('Enter')
  await page.waitForSelector('[data-testid="finance-confirm"]')
  await page.locator('[data-testid="finance-register"]').click()
  await page.waitForTimeout(500)

  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('nexora.snapshot.v1')
    const parsed = raw ? JSON.parse(raw) : { workspaces: [] }
    const finance = parsed.workspaces.find((item) => item.kind === 'finance')
    return {
      events: finance?.finance?.events ?? [],
      accounts: finance?.finance?.accounts ?? [],
      setup: finance?.finance?.setup ?? null,
    }
  })

  if (!persisted.setup?.complete) throw new Error('Setup was not persisted')
  if (!persisted.accounts.some((account) => /binance/i.test(account.name))) {
    throw new Error('Binance account missing')
  }
  if (!persisted.events.some((event) => event.type === 'income' && event.amount === 50 && event.currency === 'USDT')) {
    throw new Error(`Income event missing: ${JSON.stringify(persisted.events)}`)
  }

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  if ((await page.locator('[data-testid="finance-panel"]').count()) < 1) {
    throw new Error('Panel missing after reload')
  }

  console.log('finance UI persist ok')

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const raw = localStorage.getItem('nexora.snapshot.v1')
    const parsed = raw ? JSON.parse(raw) : { workspaces: [] }
    const finance = parsed.workspaces.find((item) => item.kind === 'finance')
    if (finance) {
      finance.finance = {
        setup: { complete: true, displayCurrency: 'USD', extraCurrencies: [] },
        accounts: finance.finance?.accounts ?? [],
        events: finance.finance?.events ?? [],
        categories: finance.finance?.categories ?? [],
      }
    }
    localStorage.setItem('nexora.snapshot.v1', JSON.stringify(parsed))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await page.route('**/api/ai/capture-global', async (route) => {
    const spaces = await page.evaluate(() => {
      const raw = localStorage.getItem('nexora.snapshot.v1')
      const parsed = raw ? JSON.parse(raw) : { workspaces: [] }
      return parsed.workspaces.map((item) => ({ id: item.id, name: item.name, kind: item.kind }))
    })
    const running = spaces.find((item) => item.kind === 'fitness')
    const finance = spaces.find((item) => item.kind === 'finance')
    const habits = spaces.find((item) => item.kind === 'habits')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'intents',
        intents: [
          {
            id: 'i-run',
            workspaceId: running?.id,
            workspaceName: running?.name,
            capture: { kind: 'new_record', values: { distancia: 10 } },
          },
          {
            id: 'i-fin',
            workspaceId: finance?.id,
            workspaceName: finance?.name,
            capture: { kind: 'new_record', values: { tipo: 'Gasto', monto: 50, categoria: 'Alimentación', descripcion: 'comida' } },
          },
          {
            id: 'i-read',
            workspaceId: habits?.id,
            workspaceName: habits?.name,
            capture: { kind: 'new_record', values: { habito: 'Leer', cumplido: true, nota: '10 páginas' } },
          },
        ].filter((item) => item.workspaceId),
      }),
    })
  })

  await page.locator('#nexora-prompt').fill('Corrí 10 km, gasté 50$ en comida y leí 10 páginas')
  await page.locator('#nexora-prompt').press('Enter')
  await page.waitForSelector('[data-testid="global-capture-sheet"]')
  await page.waitForTimeout(400)
  const stolen = await page.locator('[data-testid="finance-confirm"]').count()
  const batchCount = await page.locator('[data-testid="capture-batch"] li').count()
  if (stolen > 0 && batchCount < 2) {
    throw new Error('Finance intercept stole the mixed note')
  }
  if (batchCount < 3) {
    throw new Error(`Expected 3 mixed intents, got ${batchCount}`)
  }
  console.log('mixed capture keeps 3 intents')
} finally {
  await browser.close()
}
