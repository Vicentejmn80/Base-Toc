import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Field, FieldValue, RecordItem, Workspace } from '../../domain/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { formatDate } from '../../lib/dates'
import { formatAmount, formatNumber } from '../../lib/format'
import { recordTitle } from '../../lib/records'

interface RecordTableProps {
  workspace: Workspace
  records: RecordItem[]
  onAdd: () => void
  onEdit: (record: RecordItem) => void
  onDelete: (record: RecordItem) => void
}

export function RecordTable({ workspace, records, onAdd, onEdit, onDelete }: RecordTableProps) {
  const [query, setQuery] = useState('')
  const [filterKey, setFilterKey] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [sortKey, setSortKey] = useState(workspace.fields[0]?.key ?? '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filterField = workspace.fields.find((field) => field.key === filterKey && field.type === 'select')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = records.filter((record) => {
      if (filterKey && filterValue && record.values[filterKey] !== filterValue) return false
      if (!q) return true
      return workspace.fields.some((field) => String(record.values[field.key] ?? '').toLowerCase().includes(q))
    })
    return [...filtered].sort((a, b) => {
      const left = stringify(a.values[sortKey])
      const right = stringify(b.values[sortKey])
      return sortDir === 'asc' ? left.localeCompare(right, 'es') : right.localeCompare(left, 'es')
    })
  }, [records, query, filterKey, filterValue, sortKey, sortDir, workspace.fields])

  const selectFields = workspace.fields.filter((field) => field.type === 'select')

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar registros..."
          className="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-3 text-base outline-none focus:border-slate-400 sm:text-sm lg:max-w-xs"
        />
        <div className="flex flex-1 flex-wrap gap-2">
          <select
            value={filterKey}
            onChange={(event) => {
              setFilterKey(event.target.value)
              setFilterValue('')
            }}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-3 text-base sm:text-sm"
          >
            <option value="">Filtrar por</option>
            {selectFields.map((field) => (
              <option key={field.id} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          {filterField ? (
            <select
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-3 text-base sm:text-sm"
            >
              <option value="">Todos</option>
              {filterField.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Sin registros"
          description="No hay resultados con esos filtros. Agrega un registro o limpia la búsqueda."
          action={<Button onClick={onAdd}>Contar qué pasó</Button>}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {workspace.fields.map((field) => (
                      <th key={field.id} className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="hover:text-ink"
                          onClick={() => {
                            if (sortKey === field.key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
                            else {
                              setSortKey(field.key)
                              setSortDir('asc')
                            }
                          }}
                        >
                          {field.label}
                          {sortKey === field.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => (
                    <tr key={record.id} className="border-t border-line">
                      {workspace.fields.map((field) => (
                        <td key={field.id} className="max-w-[220px] truncate px-4 py-3">
                          <Cell field={field} value={record.values[field.key]} />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-ink" onClick={() => onEdit(record)} aria-label="Editar">
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="rounded-lg p-2 text-muted hover:bg-rose-50 hover:text-danger" onClick={() => onDelete(record)} aria-label="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {visible.map((record) => (
              <article key={record.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {recordTitle(record, 'Registro', workspace)}
                  </p>
                  <div className="flex gap-1">
                    <button type="button" className="rounded-lg p-2.5 text-muted hover:bg-soft" onClick={() => onEdit(record)} aria-label="Editar">
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="rounded-lg p-2.5 text-muted hover:bg-rose-50" onClick={() => onDelete(record)} aria-label="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  {workspace.fields.slice(1).map((field) => (
                    <div key={field.id} className="flex items-start justify-between gap-4">
                      <dt className="text-muted">{field.label}</dt>
                      <dd className="text-right">
                        <Cell field={field} value={record.values[field.key]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function stringify(value: FieldValue) {
  if (value === true) return '1'
  if (value === false) return '0'
  return String(value ?? '')
}

function Cell({ field, value }: { field: Field; value: FieldValue }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">—</span>
  if (field.type === 'select') return <Badge>{String(value)}</Badge>
  if (field.type === 'boolean') return <Badge>{value ? 'Sí' : 'No'}</Badge>
  if (field.type === 'date') return <span>{formatDate(value)}</span>
  if (field.type === 'number') {
    if (field.role === 'amount') return <span data-testid="amount-cell">{formatAmount(Number(value), field.unit)}</span>
    return <span>{formatNumber(Number(value), Number.isInteger(value) ? 0 : 1)}</span>
  }
  return <span>{String(value)}</span>
}
