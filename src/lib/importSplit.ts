export const IMPORT_BATCH_SIZE = 12

const HEADER_HINT =
  /colegio|nombre|contacto|telefono|tel[eé]fono|estado|canal|email|correo|notas|direcci[oó]n|cargo|identificador/i

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')

  for (let index = 0; index < src.length; index += 1) {
    const char = src[index]
    const next = src[index + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
        continue
      }
      if (char === '"') {
        inQuotes = false
        continue
      }
      cell += char
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell.trim())
      cell = ''
      if (row.some((item) => item)) rows.push(row)
      row = []
      continue
    }
    cell += char
  }

  row.push(cell.trim())
  if (row.some((item) => item)) rows.push(row)
  return rows
}

function looksCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return false
  const commaLines = lines.filter((line) => line.includes(',')).length
  return commaLines >= Math.max(2, Math.ceil(lines.length * 0.6))
}

function splitCsv(text: string): string[] {
  const rows = parseCsvRows(text)
  if (!rows.length) return []
  const header = rows[0]
  const headerish = header.filter(Boolean).length >= 2 && header.some((item) => HEADER_HINT.test(item))
  const data = headerish ? rows.slice(1) : rows
  return data
    .map((row) => {
      if (headerish) {
        return header
          .map((label, index) => (row[index] ? `${label}: ${row[index]}` : ''))
          .filter(Boolean)
          .join('\n')
      }
      return row.filter(Boolean).join(', ')
    })
    .filter((item) => item.trim())
}

function stripListPrefix(value: string) {
  return value.replace(/^(?:\d+[\).:\-]|\-|\*|•)\s+/, '').trim()
}

function splitByListMarkers(text: string): string[] | null {
  const parts = text
    .split(/(?:\r?\n)?\s*(?=(?:\d+[\).:\-]|\-|\*|•)\s+)/)
    .map((part) => stripListPrefix(part.trim()))
    .filter(Boolean)
  return parts.length >= 3 ? parts : null
}

export function splitImportEntries(text: string): string[] {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return []
  if (looksCsv(trimmed)) return splitCsv(trimmed)

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const blocks = trimmed.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
  const shortLines = lines.filter((line) => line.length <= 220)

  if (lines.length >= 5 && shortLines.length >= lines.length * 0.7) {
    return lines.map(stripListPrefix).filter(Boolean)
  }

  if (blocks.length >= 2) {
    return blocks.flatMap((block) => {
      const inner = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      if (inner.length >= 3 && inner.every((line) => line.length <= 220)) {
        return inner.map(stripListPrefix).filter(Boolean)
      }
      return [stripListPrefix(block) || block]
    })
  }

  const listed = splitByListMarkers(trimmed)
  if (listed) return listed
  if (lines.length >= 2) return lines.map(stripListPrefix).filter(Boolean)
  return [trimmed]
}

export function formatImportBatch(entries: string[]): string {
  return entries.map((entry, index) => `[${index + 1}]\n${entry}`).join('\n\n')
}
