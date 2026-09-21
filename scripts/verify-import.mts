import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aulasIncaFields } from '../src/data/templates.ts'
import { identifiersMatch, findDuplicateMatch } from '../src/lib/importMatch.ts'
import { splitImportEntries } from '../src/lib/importSplit.ts'
import { coerceImportValues, validateImport } from '../server/validate.ts'
import type { Workspace } from '../src/domain/types.ts'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const notes = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fase19-notes.txt'), 'utf8')
const entries = splitImportEntries(notes)
assert(entries.length >= 20, `expected 20+ entries, got ${entries.length}`)
assert(entries.length === 28, `expected 28 phone-note lines, got ${entries.length}`)
assert(
  entries.some((entry) => /franklin/i.test(entry)) && entries.some((entry) => /san jos[eé]/i.test(entry)),
  'inconsistent formats should survive as separate entries',
)

const csv = `colegio,contacto,canal
San José,María,WhatsApp
Franklin,Rosa,Correo`
const csvEntries = splitImportEntries(csv)
assert(csvEntries.length === 2, `csv should drop header, got ${csvEntries.length}`)
assert(/colegio: San José/i.test(csvEntries[0]), `csv labeled fields: ${csvEntries[0]}`)

const blocks = splitImportEntries('Primero el colegio Newton\ncontacto Ana\n\nDespués Recoleta, whatsapp')
assert(blocks.length === 2, `blank-line blocks, got ${blocks.length}`)

assert(identifiersMatch('Colegio San José', 'San Jose'), 'accent + prefix match')
assert(identifiersMatch('San Agustín', 'colegio san agustin'), 'agustin match')
assert(identifiersMatch('Colegio Markham', 'markham'), 'markham substring')
assert(identifiersMatch('Santa María', 'Colegio Santa Maria'), 'santa maria')
assert(!identifiersMatch('San Agustín', 'Santa María'), 'distinct schools')
assert(!identifiersMatch('Roosevelt', 'Pestalozzi'), 'unrelated')

const fields = aulasIncaFields()
const workspace: Workspace = {
  id: 'ws_crm',
  name: 'Aulas Inca',
  description: 'Colegios',
  icon: 'building',
  color: '#4F46E5',
  kind: 'crm',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  fields,
  goals: [],
  records: [
    {
      id: 'rec_agustin',
      workspaceId: 'ws_crm',
      values: { colegio: 'Colegio San Agustín' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rec_maria',
      workspaceId: 'ws_crm',
      values: { colegio: 'Colegio Santa María' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rec_markham',
      workspaceId: 'ws_crm',
      values: { colegio: 'Colegio Markham' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
}

const agustin = findDuplicateMatch({ colegio: 'san agustin' }, workspace)
assert(agustin?.id === 'rec_agustin', `agustin dupe: ${agustin?.id}`)
const maria = findDuplicateMatch({ colegio: 'Santa Maria' }, workspace)
assert(maria?.id === 'rec_maria', `maria dupe: ${maria?.id}`)
const markham = findDuplicateMatch({ colegio: 'Markham' }, workspace)
assert(markham?.id === 'rec_markham', `markham dupe: ${markham?.id}`)
assert(!findDuplicateMatch({ colegio: 'Newton' }, workspace), 'newton is new')

const coerced = coerceImportValues(
  [
    { key: 'colegio', label: 'Colegio', type: 'text' },
    { key: 'canal', label: 'Canal', type: 'select', options: [{ value: 'WhatsApp', label: 'WhatsApp' }] },
    { key: 'estado', label: 'Estado', type: 'select', options: [{ value: 'Contactado', label: 'Contactado' }] },
  ],
  { colegio: 'Newton', canal: 'no existe', estado: '' },
)
assert(coerced.values.colegio === 'Newton', 'keep extracted identifier')
assert(coerced.values.canal === undefined, 'do not invent select')
assert(coerced.dropped, 'invalid select marked dropped')

const validated = validateImport(
  {
    records: [
      { source: 'Newton instagram', values: { colegio: 'Newton', canal: 'Instagram' }, review: false },
      { source: 'el de surco', values: {}, review: true, reason: 'ambiguo' },
    ],
  },
  [
    { key: 'colegio', label: 'Colegio', type: 'text' },
    {
      key: 'canal',
      label: 'Canal',
      type: 'select',
      options: [
        { value: 'Instagram', label: 'Instagram' },
        { value: 'Correo', label: 'Correo' },
      ],
    },
  ],
)
assert(validated.records.length === 2, 'keep ambiguous row')
assert(validated.records[1].review, 'ambiguous stays review')
assert(validated.records[1].reason, 'reason present')

console.log(`ok import split=${entries.length} dupes+csv+lenient-coercion`)
