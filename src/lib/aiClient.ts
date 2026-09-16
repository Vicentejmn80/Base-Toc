export class AiRequestError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'AiRequestError'
    this.retryable = retryable
  }
}

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    /* ignore */
  }
  if (response.status === 504) return 'La solicitud a la IA tardó demasiado.'
  if (!response.ok) return `No se pudo completar la solicitud (error ${response.status}).`
  return 'No se pudo leer la respuesta de la IA.'
}

export async function postAi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiRequestError('La solicitud se canceló.', false)
    }
    throw new AiRequestError(
      'No hay conexión con el servidor de IA. En local, ejecuta `npm run dev`; en producción, revisa el despliegue en Vercel.',
    )
  }

  if (!response.ok) {
    throw new AiRequestError(await parseError(response))
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new AiRequestError('La respuesta de la IA no se pudo leer.')
  }
}
