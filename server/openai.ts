import { ValidationError } from './validate.js'
import { AiConfigError, AiTimeoutError } from './aiErrors.js'

export { AiConfigError, AiTimeoutError }

const TIMEOUT_MS = 15_000
const OPENAI_BASE = 'https://api.openai.com/v1'

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AiConfigError()
  return apiKey
}

export function getModel() {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
}

export function getTranscribeModel() {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-mini-transcribe'
}

function abortAfter(timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    finish() {
      clearTimeout(timer)
    },
  }
}

async function readOpenAiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string } }
    return body.error?.message || body.error?.code || `OpenAI HTTP ${response.status}`
  } catch {
    return `OpenAI HTTP ${response.status}`
  }
}

function asCaughtAiError(error: unknown, fallback: string): never {
  if (error instanceof ValidationError || error instanceof AiConfigError || error instanceof AiTimeoutError) {
    throw error
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new AiTimeoutError()
  }
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name.includes('Timeout') || message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort')) {
    throw new AiTimeoutError()
  }
  throw new Error(message || fallback)
}

export async function transcribeAudioFile(input: {
  buffer: Buffer
  filename: string
  mimeType: string
}): Promise<string> {
  const apiKey = getApiKey()
  const primary = getTranscribeModel()
  const models = primary === 'whisper-1' ? ['whisper-1'] : [primary, 'whisper-1']
  let lastError: unknown

  for (const model of models) {
    const timeout = abortAfter(60_000)
    try {
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.filename)
      form.append('model', model)
      form.append('language', 'es')
      if (model.includes('whisper')) {
        form.append(
          'prompt',
          'Nota de voz en español. Puede mezclar gastos, colegios, hábitos, entrenamientos y trabajo del día.',
        )
      }

      const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: timeout.signal,
      })
      timeout.finish()

      if (!response.ok) {
        const message = await readOpenAiError(response)
        const retryable =
          response.status === 404 ||
          message.includes('model') ||
          message.includes('invalid_model') ||
          message.includes('does not exist')
        lastError = new Error(message)
        if (!retryable || model === 'whisper-1') break
        continue
      }

      const result = (await response.json()) as { text?: string }
      const text = result.text?.trim()
      if (!text) throw new ValidationError('La transcripción quedó vacía.')
      return text
    } catch (error) {
      timeout.finish()
      lastError = error
      if (error instanceof ValidationError || error instanceof AiConfigError) throw error
      const message = error instanceof Error ? error.message : ''
      const retryable =
        message.includes('model') ||
        message.includes('404') ||
        message.includes('invalid_model') ||
        message.includes('does not exist')
      if (!retryable || model === 'whisper-1') break
    }
  }

  asCaughtAiError(lastError, 'No se pudo transcribir la nota de voz.')
}

export async function completeJson(options: {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  timeoutMs?: number
}): Promise<string> {
  const apiKey = getApiKey()
  const timeout = abortAfter(options.timeoutMs ?? TIMEOUT_MS)
  try {
    const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: options.system }, ...options.messages],
      }),
      signal: timeout.signal,
    })
    timeout.finish()

    if (!response.ok) {
      throw new Error(await readOpenAiError(response))
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[]
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content?.trim()) {
      throw new ValidationError('El modelo devolvió una respuesta vacía.')
    }
    return content
  } catch (error) {
    timeout.finish()
    asCaughtAiError(error, 'No se pudo completar la solicitud a la IA.')
  }
}
