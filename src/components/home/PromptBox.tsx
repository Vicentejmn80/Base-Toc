import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Mic, Paperclip, ArrowUp, AudioLines } from 'lucide-react'
import { cn } from '../../lib/cn'
import { simulateVoiceTranscription, type VoiceScope } from '../../lib/voiceCapture'

interface PromptBoxProps {
  value: string
  busy?: boolean
  compact?: boolean
  placeholder?: string
  voiceScope?: VoiceScope
  inputId?: string
  onVoiceTranscript?: (text: string) => void
  onChange: (value: string) => void
  onSubmit: () => void
  onSoon: (message: string) => void
}

export function PromptBox({
  value,
  busy,
  compact,
  placeholder = 'Describe lo que quieres organizar, registrar o mejorar...',
  voiceScope,
  inputId,
  onVoiceTranscript,
  onChange,
  onSubmit,
  onSoon,
}: PromptBoxProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [listening, setListening] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const fieldId = inputId ?? (compact ? 'nexora-prompt-space' : 'nexora-prompt')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 180)}px`
  }, [value, compact])

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    if (!value.trim() || busy) return
    onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (!listening) return
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 0.1)
    }, 100)
    return () => window.clearInterval(timer)
  }, [listening])

  async function handleVoice() {
    if (!voiceScope) {
      onSoon('La entrada por voz estará disponible próximamente.')
      return
    }
    if (listening || busy) return
    setListening(true)
    setElapsed(0)
    try {
      const result = await simulateVoiceTranscription(voiceScope)
      const text = result.transcript
      onChange(text)
      onVoiceTranscript?.(text)
    } finally {
      setListening(false)
      setElapsed(0)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'prompt-orbit shadow-[var(--shadow-card)]',
        compact && 'is-compact',
        focused && 'is-focused',
      )}
    >
      <label className="sr-only" htmlFor={fieldId}>
        Instrucción
      </label>
      <div className={cn('prompt-orbit-inner p-3 sm:p-4', compact && 'p-3')}>
        <textarea
          id={fieldId}
          ref={ref}
          rows={compact ? 2 : 3}
          value={value}
          disabled={busy}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            'w-full resize-none bg-transparent text-base leading-6 text-ink outline-none placeholder:text-slate-400 disabled:opacity-60 sm:text-[15px]',
            compact ? 'min-h-[52px]' : 'min-h-[84px]',
          )}
        />
        {listening ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
            <span className="inline-flex items-center gap-2">
              <AudioLines size={14} className="animate-pulse" />
              Escuchando...
            </span>
            <span>{elapsed.toFixed(1)}s</span>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-xl p-2.5 text-muted transition-colors hover:bg-soft hover:text-ink"
              onClick={() => onSoon('Adjuntar archivos estará disponible próximamente.')}
              aria-label="Adjuntar"
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              className={cn(
                'rounded-xl p-2.5 text-muted transition-colors hover:bg-soft hover:text-ink',
                listening && 'bg-violet-100 text-violet-700',
              )}
              onClick={handleVoice}
              aria-label="Micrófono"
            >
              <Mic size={18} />
            </button>
          </div>
          <button
            type="submit"
            disabled={!value.trim() || busy}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Enviar"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </form>
  )
}
