import { AiRequestError, postAi } from './aiClient'
import { blobToBase64, filenameForMime } from './audioRecorder'

export async function transcribeVoiceNote(blob: Blob, mimeType: string, signal?: AbortSignal) {
  if (blob.size < 80) {
    throw new AiRequestError('La nota quedó muy corta. Cuéntame un poco más.', false)
  }

  const audio = await blobToBase64(blob)
  const result = await postAi<{ transcript: string }>(
    '/api/ai/transcribe',
    {
      audio,
      mimeType,
      filename: filenameForMime(mimeType),
    },
    signal,
  )

  const transcript = result.transcript?.trim()
  if (!transcript) {
    throw new AiRequestError('No alcancé a entender la nota. ¿La grabamos otra vez?')
  }
  return transcript
}
