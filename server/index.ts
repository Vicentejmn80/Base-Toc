import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAnalyze } from './handlers/analyze'
import { handleCapture } from './handlers/capture'
import { handleCaptureGlobal } from './handlers/captureGlobal'
import { handleCreation } from './handlers/creation'
import { handleTranscribe } from './handlers/transcribe'
import { errorMessage, errorStatus } from './handlers/http'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

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
  res.json({ ok: true, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' })
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

app.post('/api/ai/transcribe', (req, res) => {
  void sendJson(res, handleTranscribe, req.body)
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Nexora AI server listening on http://127.0.0.1:${port}`)
})
