import { AiConfigError, AiTimeoutError } from '../aiErrors.js'
import { ValidationError } from '../validate.js'
import { HttpError } from './httpError.js'

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
