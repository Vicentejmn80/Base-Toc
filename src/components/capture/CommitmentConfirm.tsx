import { dueLabel } from '../../lib/commitment'
import { Button } from '../ui/Button'

export function CommitmentConfirm({
  description,
  dueDate,
  workspaceName,
  onConfirm,
  onEdit,
  onCancel,
}: {
  description: string
  dueDate: string
  workspaceName?: string
  onConfirm: () => void
  onEdit: () => void
  onCancel?: () => void
}) {
  return (
    <div className="space-y-4" data-testid="commitment-confirm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Lo que va a pasar</p>
      <div className="rounded-2xl bg-canvas px-4 py-3">
        <p className="text-[15px] text-ink">{description}</p>
        <p className="mt-1 text-sm text-muted">
          {dueLabel(dueDate)}
          {workspaceName ? ` · cuando se cumpla, iría a ${workspaceName}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onEdit}>
          Corregir
        </Button>
        <Button onClick={onConfirm} data-testid="commitment-register">
          Guardar
        </Button>
      </div>
    </div>
  )
}
