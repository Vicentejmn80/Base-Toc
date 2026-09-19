export class AiTimeoutError extends Error {
  constructor() {
    super('La solicitud a la IA tardó más de 15 segundos.')
    this.name = 'AiTimeoutError'
  }
}

export class AiConfigError extends Error {
  constructor() {
    super('Falta OPENAI_API_KEY en el servidor. Créala en Vercel → Settings → Environment Variables (Production).')
    this.name = 'AiConfigError'
  }
}
