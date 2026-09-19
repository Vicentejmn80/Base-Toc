import { ValidationError } from './validate'
import { AiConfigError, AiTimeoutError } from './aiErrors'

export { AiConfigError, AiTimeoutError }

const TIMEOUT_MS = 15_000

type OpenAIClient = {
  chat: {
    completions: {
      create: (input: {
        model: string
        temperature: number
        response_format: { type: 'json_object' }
        messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
      }) => Promise<{ choices: { message?: { content?: string | null } }[] }>
    }
  }
  audio: {
    transcriptions: {
      create: (input: {
        file: unknown
        model: string
        language: string
        prompt?: string
      }) => Promise<{ text?: string }>
    }
  }
}

async function getClient(timeoutMs = TIMEOUT_MS): Promise<OpenAIClient> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AiConfigError()
  const mod = await import('openai')
  const OpenAI = mod.default
  return new OpenAI({ apiKey, timeout: timeoutMs }) as unknown as OpenAIClient
}

export function getModel() {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
}

export function getTranscribeModel() {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-mini-transcribe'
}

export async function transcribeAudioFile(input: {
  buffer: Buffer
  filename: string
  mimeType: string
}): Promise<string> {
  const primary = getTranscribeModel()
  const models = primary === 'whisper-1' ? ['whisper-1'] : [primary, 'whisper-1']
  let lastError: unknown

  for (const model of models) {
    try {
      const client = await getClient(60_000)
      const { toFile } = await import('openai')
      const file = await toFile(input.buffer, input.filename, { type: input.mimeType })
      const result = await client.audio.transcriptions.create({
        file,
        model,
        language: 'es',
        ...(model.includes('whisper')
          ? {
              prompt:
                'Nota de voz en español. Puede mezclar gastos, colegios, hábitos, entrenamientos y trabajo del día.',
            }
          : {}),
      })
      const text = result.text?.trim()
      if (!text) throw new ValidationError('La transcripción quedó vacía.')
      return text
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ''
      const retryable =
        message.includes('model') ||
        message.includes('404') ||
        message.includes('invalid_model') ||
        message.includes('does not exist')
      if (!retryable || model === 'whisper-1') break
    }
  }

  if (lastError instanceof ValidationError || lastError instanceof AiConfigError) throw lastError
  const name = lastError instanceof Error ? lastError.name : ''
  const message = lastError instanceof Error ? lastError.message : ''
  if (name.includes('Timeout') || message.toLowerCase().includes('timeout')) {
    throw new AiTimeoutError()
  }
  throw new Error(message || 'No se pudo transcribir la nota de voz.')
}

export async function completeJson(options: {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  timeoutMs?: number
}): Promise<string> {
  const client = await getClient(options.timeoutMs)
  try {
    const response = await client.chat.completions.create({
      model: getModel(),
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: options.system }, ...options.messages],
    })
    const content = response.choices[0]?.message?.content
    if (!content?.trim()) {
      throw new ValidationError('El modelo devolvió una respuesta vacía.')
    }
    return content
  } catch (error) {
    if (error instanceof ValidationError || error instanceof AiConfigError) throw error
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : ''
    if (name.includes('Timeout') || message.toLowerCase().includes('timeout')) {
      throw new AiTimeoutError()
    }
    throw new Error(message || 'No se pudo completar la solicitud a la IA.')
  }
}
