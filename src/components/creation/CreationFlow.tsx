import { Check } from 'lucide-react'
import type { WorkspaceProposal } from '../../domain/types'
import { CREATION_STEPS, materializeProposal } from '../../interpretation/creation'
import { useAppExperience } from '../../lib/experience'
import { useAppStore } from '../../state/store'
import { useToast } from '../../state/toast'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

export type CreationStatus = 'idle' | 'loading' | 'error' | 'ready'

interface CreationFlowProps {
  proposal: WorkspaceProposal | null
  status: CreationStatus
  errorMessage?: string | null
  onClose: () => void
  onOpened: (workspaceId: string) => void
  onRetry?: () => void
}

export function CreationFlow({
  proposal,
  status,
  errorMessage,
  onClose,
  onOpened,
  onRetry,
}: CreationFlowProps) {
  const { createWorkspace } = useAppStore()
  const { showToast } = useToast()
  const plain = useAppExperience() === 'mobile'

  if (status === 'idle' || (status === 'ready' && !proposal)) return null

  const ready = status === 'ready' && Boolean(proposal)
  const loading = status === 'loading'
  const failed = status === 'error'

  function confirm() {
    if (!proposal) return
    if (proposal.existingWorkspaceId) {
      showToast(`Abriendo ${proposal.name}`, 'success')
      onOpened(proposal.existingWorkspaceId)
      return
    }
    const workspace = materializeProposal(proposal)
    createWorkspace(workspace)
    showToast(`Espacio ${workspace.name} listo`, 'success')
    onOpened(workspace.id)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Cerrar" />
      <div className="ai-accent relative z-10 w-full max-w-xl overflow-hidden rounded-3xl shadow-[var(--shadow-float)]">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <p className="ai-label text-xs font-semibold uppercase tracking-[0.16em]">
            {failed ? (plain ? 'No pude armarlo' : 'No se pudo crear') : ready ? (plain ? '¿Lo creamos?' : 'Espacio listo para confirmar') : (plain ? 'Un segundo' : 'Diseñando tu espacio')}
          </p>
          <h2 className="type-title mt-2">
            {ready && proposal ? proposal.name : failed ? (plain ? 'Se trabó un momento' : 'La IA no respondió') : (plain ? 'Estoy armando este espacio' : 'Diseñando tu espacio')}
          </h2>
          <p className="type-meta mt-1">
            {ready && proposal
              ? proposal.description
              : failed
                ? errorMessage || (plain ? 'No pude completar eso ahora.' : 'No se pudo completar la solicitud.')
                : plain
                  ? 'Dame un segundo, estoy armando este espacio.'
                  : 'Esperando la respuesta real del modelo. Esto puede tardar unos segundos.'}
          </p>
          {loading ? (
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-soft">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#93c5fd,#818cf8,#c084fc,#f9a8d4)]" />
            </div>
          ) : null}
        </div>

        <div className="px-5 py-5 sm:px-6">
          {loading || ready ? (
            <ol className="space-y-3">
              {CREATION_STEPS.map((item, index) => {
                const done = ready || index === 0
                const current = loading && index === 1
                return (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] transition-colors',
                        done && !current
                          ? 'border-emerald-200 bg-success-soft text-success'
                          : current
                            ? 'border-violet-200 bg-accent-soft text-accent'
                            : 'border-line text-slate-400',
                      )}
                    >
                      {done && !current ? <Check size={12} /> : index + 1}
                    </span>
                    <span className={done || current ? 'font-medium text-ink' : 'text-muted'}>{item.label}</span>
                  </li>
                )
              })}
            </ol>
          ) : null}

          {failed ? (
            <div className="rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
              {errorMessage || (plain ? 'No pude completar eso ahora. ¿Lo intentamos de nuevo?' : 'No se pudo completar la solicitud a la IA.')}
            </div>
          ) : null}

          {ready && proposal ? (
            <div className="animate-fade-up mt-5 rounded-2xl border border-line bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Campos propuestos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {proposal.fields.map((field) => (
                  <span key={field.id} className="rounded-full bg-white px-2.5 py-1 text-xs text-muted ring-1 ring-line">
                    {field.label}
                  </span>
                ))}
              </div>
              {proposal.existingWorkspaceId ? (
                <p className="mt-3 text-xs text-muted">
                  Ya tienes este espacio. Al confirmar se abrirá el existente en lugar de duplicarlo.
                </p>
              ) : null}

              <div className="mt-4 rounded-xl bg-white px-3 py-3 ring-1 ring-line">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Por qué estos campos
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted">
                  {proposal.rationale.slice(0, 3).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
          <Button variant="secondary" onClick={onClose}>
            {loading ? 'Cancelar' : 'Cerrar'}
          </Button>
          {failed && onRetry ? (
            <Button onClick={onRetry}>Reintentar</Button>
          ) : (
            <Button onClick={confirm} disabled={!ready}>
              {proposal?.existingWorkspaceId ? 'Abrir espacio' : 'Confirmar y entrar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
