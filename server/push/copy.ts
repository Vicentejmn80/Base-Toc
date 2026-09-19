export function commitmentQuestion(description: string) {
  let text = description.trim().replace(/[¿?!.]+$/g, '')
  text = text.replace(/^(hoy|mañana|manana|pasado mañana|pasado manana)\s+/i, '')
  text = text.replace(/^(tengo que|debo|hay que|voy a|vamos a)\s+/i, '')

  const verbs: Array<[RegExp, string]> = [
    [/^pag(o|ar|aste|aré|are)\s+/i, 'pagaste '],
    [/^llam(o|ar|aste)\s+/i, 'llamaste '],
    [/^revis(o|ar|aste)\s+/i, 'revisaste '],
    [/^escrib(í|i|ir|iste)\s+/i, 'escribiste '],
    [/^env(ío|io|iar|iaste)\s+/i, 'enviaste '],
  ]
  for (const [pattern, replacement] of verbs) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement)
      break
    }
  }

  if (!/\bhoy\b/i.test(text)) text = `${text} hoy`
  const body = text.charAt(0).toUpperCase() + text.slice(1)
  return `¿${body}?`
}

export function weeklySummaryBody(activeAreas: number, totalAreas: number) {
  if (totalAreas <= 0) return 'Toca para ver cómo te fue.'
  if (activeAreas <= 0) return 'Toca para ver el detalle.'
  if (activeAreas === totalAreas) {
    return `Avanzaste en tus ${totalAreas} áreas. Toca para ver el detalle.`
  }
  return `Avanzaste en ${activeAreas} de ${totalAreas} áreas. Toca para ver el detalle.`
}

export function digestBody(descriptions: string[]) {
  if (descriptions.length === 1) return commitmentQuestion(descriptions[0])
  const list = descriptions.slice(0, 3).join(', ')
  const extra = descriptions.length > 3 ? ` y ${descriptions.length - 3} más` : ''
  return `Tienes ${descriptions.length} pendientes: ${list}${extra}.`
}
