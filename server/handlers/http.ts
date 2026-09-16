import { AiConfigError, AiTimeoutError } from '../openai.ts'
import { ValidationError } from '../validate.ts'
import { HttpError } from './shared.ts'

export function errorStatus(error: unknown) {
  if (error instanceof HttpError) return error.status
  if (error instanceof AiConfigError) return 500
  if (error instanceof AiTimeoutError) return 504
  if (error instanceof ValidationError) return 502
  return 500
}

export function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo completar la solicitud a la IA.'
}
