import { AiConfigError, AiTimeoutError } from '../aiErrors'
import { ValidationError } from '../validate'
import { HttpError } from './shared'

export function errorStatus(error: unknown) {
  if (error instanceof HttpError) return error.status
  if (error instanceof AiConfigError) return 503
  if (error instanceof AiTimeoutError) return 504
  if (error instanceof ValidationError) return 502
  return 500
}

export function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo completar la solicitud a la IA.'
}
