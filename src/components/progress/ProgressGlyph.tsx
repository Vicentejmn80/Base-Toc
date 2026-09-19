import { cn } from '../../lib/cn'

export type GlyphId = 'path' | 'orbit' | 'cycle' | 'modules' | 'pages' | 'stack'

export function glyphFor(name?: string, kind?: string): GlyphId {
  const key = `${name ?? ''} ${kind ?? ''}`.toLowerCase()
  if (/activity|dumbbell|fitness|run/.test(key)) return 'path'
  if (/wallet|finance|money/.test(key)) return 'orbit'
  if (/sparkles|habit/.test(key)) return 'cycle'
  if (/building|crm|aula/.test(key)) return 'modules'
  if (/book|lectur/.test(key)) return 'pages'
  return 'stack'
}

export function ProgressGlyph({
  name,
  kind,
  className,
}: {
  name?: string
  kind?: string
  className?: string
}) {
  const id = glyphFor(name, kind)
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('progress-glyph', className)}
      aria-hidden
    >
      {id === 'path' ? <PathGlyph /> : null}
      {id === 'orbit' ? <OrbitGlyph /> : null}
      {id === 'cycle' ? <CycleGlyph /> : null}
      {id === 'modules' ? <ModulesGlyph /> : null}
      {id === 'pages' ? <PagesGlyph /> : null}
      {id === 'stack' ? <StackGlyph /> : null}
    </svg>
  )
}

function PathGlyph() {
  return (
    <>
      <path
        d="M4 17.5 C8 17.5 10 8.5 14.5 8.5 C17.5 8.5 18.5 12 20 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle className="progress-glyph-dot" cx="20" cy="13.5" r="1.7" fill="currentColor" />
    </>
  )
}

function OrbitGlyph() {
  return (
    <>
      <path
        d="M12 5.2 A6.8 6.8 0 1 1 6.4 7.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3.2 2.4"
      />
      <circle className="progress-glyph-dot" cx="12" cy="5.2" r="1.6" fill="currentColor" />
    </>
  )
}

function CycleGlyph() {
  return (
    <>
      <path
        d="M17.6 7.2 A6.6 6.6 0 1 0 18 12.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle className="progress-glyph-dot" cx="17.7" cy="7.3" r="1.6" fill="currentColor" />
    </>
  )
}

function ModulesGlyph() {
  return (
    <>
      <path d="M6 16.5 V11.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16.5 V7.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 16.5 V9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.2 17.2 H18.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle className="progress-glyph-dot" cx="12" cy="7.2" r="1.5" fill="currentColor" />
    </>
  )
}

function PagesGlyph() {
  return (
    <>
      <path d="M6.5 16.2 H16.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.4 12.6 H17.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.3 9 H17.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle className="progress-glyph-dot" cx="17.8" cy="9" r="1.5" fill="currentColor" />
    </>
  )
}

function StackGlyph() {
  return (
    <>
      <path
        d="M7 15.8 L12 18.2 L17 15.8"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 12.2 L12 14.6 L17 12.2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.6 L12 11 L17 8.6"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="progress-glyph-dot" cx="12" cy="11" r="1.45" fill="currentColor" />
    </>
  )
}
