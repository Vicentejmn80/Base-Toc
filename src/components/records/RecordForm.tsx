import { useEffect, useMemo, useState } from 'react'
import type { Field, FieldValue, RecordItem, Workspace } from '../../domain/types'
import { Button } from '../ui/Button'
import { parseDate } from '../../lib/dates'

interface RecordFormProps {
  workspace: Workspace
  record?: RecordItem | null
  onCancel: () => void
  onSave: (values: Record<string, FieldValue>) => void
}

function emptyValues(workspace: Workspace, record?: RecordItem | null) {
  const values: Record<string, FieldValue> = {}
  for (const field of workspace.fields) {
    if (record) {
      values[field.key] = record.values[field.key] ?? defaultValue(field)
    } else {
      values[field.key] = defaultValue(field)
    }
  }
  return values
}

function defaultValue(field: Field): FieldValue {
  if (field.type === 'boolean') return false
  if (field.type === 'number') return null
  if (field.type === 'select') return field.options?.[0]?.value ?? ''
  if (field.type === 'date') return ''
  return ''
}

export function validateRecord(workspace: Workspace, values: Record<string, FieldValue>) {
  const errors: Record<string, string> = {}
  for (const field of workspace.fields) {
    const value = values[field.key]
    if (field.required && (value === '' || value === null || value === undefined)) {
      errors[field.key] = `${field.label} es obligatorio.`
      continue
    }
    if (field.type === 'number' && value !== null && value !== '' && Number.isNaN(Number(value))) {
      errors[field.key] = 'Debe ser un número válido.'
    }
    if (field.type === 'date' && value && !parseDate(String(value))) {
      errors[field.key] = 'La fecha no es válida.'
    }
    if (field.type === 'select' && value && field.options && !field.options.some((option) => option.value === value)) {
      errors[field.key] = 'Elige una opción válida.'
    }
  }
  return errors
}

export function RecordForm({ workspace, record, onCancel, onSave }: RecordFormProps) {
  const [values, setValues] = useState(() => emptyValues(workspace, record))
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setValues(emptyValues(workspace, record))
    setErrors({})
  }, [workspace, record])

  const title = useMemo(
    () => (record ? 'Editar registro' : 'Agregar registro'),
    [record],
  )

  function update(key: string, value: FieldValue) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit() {
    const nextErrors = validateRecord(workspace, values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSave(values)
  }

  return (
    <div>
      <div className="mb-4 hidden">
        <h3>{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {workspace.fields.map((field) => (
          <label key={field.id} className={field.type === 'longText' ? 'sm:col-span-2' : undefined}>
            <span className="mb-1.5 block text-sm font-medium">
              {field.label}
              {field.required ? <span className="text-danger"> *</span> : null}
            </span>
            <FieldControl field={field} value={values[field.key]} onChange={(value) => update(field.key, value)} />
            {errors[field.key] ? <span className="mt-1 block text-xs text-danger">{errors[field.key]}</span> : null}
          </label>
        ))}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" className="min-h-11" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className="min-h-11" onClick={handleSubmit}>
          Guardar
        </Button>
      </div>
    </div>
  )
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field
  value: FieldValue
  onChange: (value: FieldValue) => void
}) {
  const shared = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 py-3 text-base outline-none transition-shadow focus:border-slate-400 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.08)] sm:text-sm'

  if (field.type === 'longText') {
    return (
      <textarea
        className={`${shared} min-h-24`}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select className={shared} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecciona</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => onChange(value !== true)}
        className={`flex min-h-11 w-full items-center rounded-xl border px-3 text-base sm:text-sm ${value === true ? 'border-emerald-200 bg-success-soft text-success' : 'border-line bg-white text-muted'}`}
      >
        {value === true ? 'Cumplido' : 'No cumplido'}
      </button>
    )
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={shared}
        value={value === null ? '' : String(value)}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    )
  }

  return (
    <input
      type={field.type === 'date' ? 'date' : 'text'}
      className={shared}
      value={String(value ?? '')}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
