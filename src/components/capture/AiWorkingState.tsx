import { useEffect, useState, type CSSProperties } from 'react'

export type AiWorkingStep = 'listening' | 'transcribing' | 'understanding'

const COPY: Record<AiWorkingStep, { title: string; body: string }> = {
  listening: {
    title: 'Escuchando',
    body: 'Habla con calma. Toca el micrófono otra vez cuando termines.',
  },
  transcribing: {
    title: 'Transcribiendo tu voz',
    body: 'Estoy pasando tu nota a texto. Todavía no anoto nada.',
  },
  understanding: {
    title: 'Entendiendo tu mensaje',
    body: 'Estoy viendo a dónde iría cada cosa. Nada se guarda hasta que confirmes.',
  },
}

export function AiWorkingState({
  step,
  level = 0.2,
  startedAt,
}: {
  step: AiWorkingStep
  level?: number
  startedAt?: number
}) {
  const copy = COPY[step]
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    setSlow(false)
    const from = startedAt ?? Date.now()
    const timer = window.setTimeout(() => setSlow(true), Math.max(0, 8000 - (Date.now() - from)))
    return () => window.clearTimeout(timer)
  }, [step, startedAt])

  return (
    <div className="ai-working" data-testid={`ai-working-${step}`}>
      <div className="ai-working-blobs" aria-hidden="true">
        <span className="ai-working-blob a" />
        <span className="ai-working-blob b" />
      </div>
      <p className="ai-label text-xs font-semibold uppercase tracking-[0.14em]">{copy.title}</p>
      <p className="mt-1.5 text-sm text-ink">{copy.body}</p>
      <div className="ai-wave" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={index}
            className="ai-wave-bar"
            style={
              {
                '--bar': String(0.35 + ((index % 3) + 1) * 0.2 + level * (index % 2 === 0 ? 0.8 : 0.45)),
              } as CSSProperties
            }
          />
        ))}
      </div>
      {slow ? (
        <p className="mt-2 text-xs text-muted">Esto está tardando un poco más de lo usual. Sigo en ello.</p>
      ) : null}
    </div>
  )
}

