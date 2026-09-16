import { useToast } from '../../state/toast'
import { cn } from '../../lib/cn'

export function ToastViewport() {
  const { toasts, dismissToast } = useToast()

  return (
    <div className="pointer-events-none fixed right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:bottom-6">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            'pointer-events-auto rounded-2xl border px-4 py-3 text-left text-sm shadow-[var(--shadow-card)]',
            toast.tone === 'success' && 'border-emerald-100 bg-success-soft text-success',
            toast.tone === 'danger' && 'border-rose-100 bg-danger-soft text-danger',
            toast.tone === 'info' && 'border-line bg-white text-ink',
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
