import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-slate-800 disabled:bg-slate-300',
  secondary: 'bg-white text-ink border border-line hover:bg-soft disabled:text-slate-400',
  ghost: 'bg-transparent text-muted hover:bg-soft hover:text-ink disabled:text-slate-300',
  danger: 'bg-danger-soft text-danger hover:bg-red-100 disabled:opacity-50',
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
