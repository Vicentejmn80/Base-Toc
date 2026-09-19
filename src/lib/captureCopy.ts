import { useAppExperience } from './experience'

export function humanAiError(message: string, plain: boolean) {
  if (!plain) return message
  const text = message.toLowerCase()
  if (text.includes('openai') || text.includes('servidor') || text.includes('conexión')) {
    return 'No pude conectarme ahora. Prueba otra vez en un momento.'
  }
  if (text.includes('tardó') || text.includes('tardado') || text.includes('504')) {
    return 'Me está tomando más de lo normal. ¿Lo intentamos otra vez?'
  }
  if (text.includes('json') || text.includes('modelo') || text.includes('valid')) {
    return 'No alcancé a entenderlo bien. ¿Me lo cuentas otra vez, un poco más simple?'
  }
  if (text.includes('cancel')) return 'Listo, lo dejé ahí.'
  return 'No pude anotarlo todavía. ¿Lo intentamos de nuevo?'
}

export function captureLoadingCopy(plain: boolean) {
  return plain ? 'Dame un segundo, estoy acomodando lo que contaste' : 'Interpretando lo que pasó…'
}

export function captureHeadline(
  kind: 'new_record' | 'update_record',
  workspaceName: string,
  recordTitle?: string,
  plain = false,
) {
  if (!plain) {
    return kind === 'update_record'
      ? `Actualizar ${recordTitle ?? 'registro'}`
      : 'Nuevo registro'
  }
  if (kind === 'update_record') {
    return recordTitle
      ? `Voy a actualizar esto en ${workspaceName}: ${recordTitle}`
      : `Voy a actualizar esto en ${workspaceName}`
  }
  return `Voy a anotar esto en ${workspaceName}`
}

export function captureConfirmLabel(plain: boolean) {
  return plain ? 'Sí, anótalo' : 'Confirmar y guardar'
}

export function captureSavedToast(workspaceName: string, updated: boolean, plain: boolean) {
  if (!plain) return updated ? 'Registro actualizado' : 'Registro guardado'
  return updated ? `Listo, lo actualicé en ${workspaceName}` : `Listo, lo anoté en ${workspaceName}`
}

export function usePlainLanguage() {
  return useAppExperience() === 'mobile'
}
