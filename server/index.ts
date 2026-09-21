import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAnalyze } from './handlers/analyze.js'
import { handleCapture } from './handlers/capture.js'
import { handleCaptureGlobal } from './handlers/captureGlobal.js'
import { handleCreation } from './handlers/creation.js'
import { handleImport } from './handlers/import.js'
import { handleTranscribe } from './handlers/transcribe.js'
import { errorMessage, errorStatus } from './handlers/http.js'
import {
  handleCronPush,
  handlePushConfig,
  handlePushInbox,
  handlePushOpened,
  handlePushSettings,
  handlePushSubscribe,
  handlePushSync,
} from './push/handlers.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })
// Push endpoints read VAPID_* and CRON_SECRET from those files.

const app = express()
const port = Number(process.env.PORT) || 8787

app.use(
  cors({
    origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/],
  }),
)
app.use(express.json({ limit: '12mb' }))

async function sendJson(
  res: express.Response,
  run: (body: unknown) => Promise<unknown>,
  body: unknown,
) {
  try {
    const result = await run(body)
    res.json(result)
  } catch (error) {
    console.error('[api]', error instanceof Error ? error.stack || error.message : error)
    res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
  })
})

app.post('/api/ai/creation', (req, res) => {
  void sendJson(res, handleCreation, req.body)
})

app.post('/api/ai/capture', (req, res) => {
  void sendJson(res, handleCapture, req.body)
})

app.post('/api/ai/capture-global', (req, res) => {
  void sendJson(res, handleCaptureGlobal, req.body)
})

app.post('/api/ai/analyze', (req, res) => {
  void sendJson(res, handleAnalyze, req.body)
})

app.post('/api/ai/import', (req, res) => {
  void sendJson(res, handleImport, req.body)
})

app.post('/api/ai/transcribe', (req, res) => {
  void sendJson(res, handleTranscribe, req.body)
})

app.get('/api/push/config', (_req, res) => {
  void sendJson(res, handlePushConfig, {})
})

app.post('/api/push/subscribe', (req, res) => {
  void sendJson(res, handlePushSubscribe, req.body)
})

app.post('/api/push/sync', (req, res) => {
  void sendJson(res, handlePushSync, req.body)
})

app.get('/api/push/inbox', (req, res) => {
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : ''
  void sendJson(res, () => handlePushInbox(deviceId), {})
})

app.post('/api/push/opened', (req, res) => {
  void sendJson(res, handlePushOpened, req.body)
})

app.post('/api/push/settings', (req, res) => {
  void sendJson(res, handlePushSettings, req.body)
})

app.get('/api/cron/push', (req, res) => {
  void sendJson(
    res,
    () =>
      handleCronPush({
        authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
        secret: typeof req.query.secret === 'string' ? req.query.secret : undefined,
        at: typeof req.query.at === 'string' ? req.query.at : undefined,
      }),
    {},
  )
})

app.post('/api/cron/push', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  void sendJson(
    res,
    () =>
      handleCronPush({
        authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
        secret: typeof body.secret === 'string' ? body.secret : undefined,
        at: typeof body.at === 'string' ? body.at : undefined,
      }),
    {},
  )
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Nexora AI server listening on http://127.0.0.1:${port}`)
})
