import {
  Activity,
  Building2,
  Layers,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'

const icons: Record<string, LucideIcon> = {
  building: Building2,
  wallet: Wallet,
  activity: Activity,
  sparkles: Sparkles,
  layers: Layers,
}

export function WorkspaceIcon({
  name,
  color,
  size = 'md',
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const Icon = icons[name] ?? Layers
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-2xl text-white',
        size === 'sm' && 'h-8 w-8 rounded-xl',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
      )}
      style={{ background: color }}
    >
      <Icon size={size === 'lg' ? 22 : size === 'sm' ? 15 : 18} />
    </span>
  )
}
