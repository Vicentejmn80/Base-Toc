import { cn } from '../../lib/cn'
import { ProgressGlyph } from '../progress/ProgressGlyph'

export function WorkspaceIcon({
  name,
  color,
  size = 'md',
  kind,
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  kind?: string
}) {
  return (
    <span
      className={cn(
        'progress-glyph-frame inline-flex items-center justify-center',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
      )}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, white)`,
      }}
    >
      <ProgressGlyph
        name={name}
        kind={kind}
        className={cn(size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')}
      />
    </span>
  )
}
