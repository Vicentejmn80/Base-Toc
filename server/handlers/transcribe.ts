import { transcribeAudioFile } from '../openai.ts'
import { HttpError } from './shared.ts'

const MAX_BYTES = 10 * 1024 * 1024

function filenameFor(mimeType: string) {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'nota.m4a'
  if (mimeType.includes('ogg')) return 'nota.ogg'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'nota.mp3'
  if (mimeType.includes('wav')) return 'nota.wav'
  return 'nota.webm'
}

export async function handleTranscribe(body: unknown) {
  const payload = body as Record<string, unknown>
  const audio = typeof payload?.audio === 'string' ? payload.audio.trim() : ''
  if (!audio) {
    throw new HttpError(400, 'No llegó la nota de voz. Grábala otra vez.')
  }

  const mimeType =
    typeof payload?.mimeType === 'string' && payload.mimeType.trim()
      ? payload.mimeType.trim()
      : 'audio/webm'
  const filename =
    typeof payload?.filename === 'string' && payload.filename.trim()
      ? payload.filename.trim()
      : filenameFor(mimeType)

  let buffer: Buffer
  try {
    buffer = Buffer.from(audio, 'base64')
  } catch {
    throw new HttpError(400, 'No pude leer el audio. Prueba grabando de nuevo.')
  }

  if (buffer.length < 80) {
    throw new HttpError(400, 'La nota quedó muy corta. Cuéntame un poco más.')
  }
  if (buffer.length > MAX_BYTES) {
    throw new HttpError(400, 'La nota es demasiado larga. Prueba en partes más cortas.')
  }

  const transcript = await transcribeAudioFile({ buffer, filename, mimeType })
  return { transcript }
}
