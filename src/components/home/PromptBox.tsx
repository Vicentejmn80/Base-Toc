import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Mic, Paperclip, ArrowUp, Square } from 'lucide-react'
import { cn } from '../../lib/cn'
import { AudioRecorder, canRecordAudio } from '../../lib/audioRecorder'
import { transcribeVoiceNote } from '../../lib/transcribeAudio'
import { AiRequestError } from '../../lib/aiClient'
import type { VoiceScope } from '../../lib/voiceCapture'
import { AiWorkingState } from '../capture/AiWorkingState'

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

type VoicePhase = 'idle' | 'recording' | 'transcribing'

export function PromptBox({
  value,
  busy,
  compact,
  placeholder = 'Cuéntame qué pasó...',
  voiceScope,
  inputId,
  onVoiceTranscript,
  onChange,
  onSubmit,
  onSoon,
}: PromptBoxProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<AudioRecorder | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0.2)
  const [stepStartedAt, setStepStartedAt] = useState(0)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const fieldId = inputId ?? (compact ? 'nexora-prompt-space' : 'nexora-prompt')
  const voiceBusy = phase !== 'idle'

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 180)}px`
  }, [value, compact])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      recorderRef.current?.cancel()
    }
  }, [])

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    if (!value.trim() || busy || voiceBusy) return
    onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (phase !== 'recording') return
    const timer = window.setInterval(() => {
      setElapsed((current) => current + 0.1)
    }, 100)
    return () => window.clearInterval(timer)
  }, [phase])

  async function startRecording() {
    setVoiceError(null)
    const recorder = new AudioRecorder()
    recorder.onLevel = setLevel
    recorderRef.current = recorder
    await recorder.start()
    setElapsed(0)
    setStepStartedAt(Date.now())
    setPhase('recording')
  }

  async function finishRecording() {
    const recorder = recorderRef.current
    if (!recorder) return
    setStepStartedAt(Date.now())
    setPhase('transcribing')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const recorded = await recorder.stop()
      recorderRef.current = null
      if (recorded.durationMs < 600) {
        throw new AiRequestError('La nota quedó muy corta. Mantén pulsado un poco más.', false)
      }
      const transcript = await transcribeVoiceNote(recorded.blob, recorded.mimeType, controller.signal)
      if (controller.signal.aborted) return
      onChange(transcript)
      onVoiceTranscript?.(transcript)
      setPhase('idle')
      setElapsed(0)
    } catch (error) {
      if (controller.signal.aborted) return
      recorderRef.current = null
      setPhase('idle')
      setElapsed(0)
      const message =
        error instanceof AiRequestError
          ? error.message
          : error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Necesito permiso del micrófono para escuchar tu nota.'
            : error instanceof Error
              ? error.message
              : 'No pude pasar la nota a texto.'
      setVoiceError(message)
      onSoon(message)
    }
  }

  async function handleVoice() {
    if (!voiceScope) {
      onSoon('La entrada por voz estará disponible próximamente.')
      return
    }
    if (busy || phase === 'transcribing') return
    if (!canRecordAudio()) {
      const message = 'Este navegador no puede grabar audio. Prueba en Chrome o Safari.'
      setVoiceError(message)
      onSoon(message)
      return
    }
    if (phase === 'recording') {
      await finishRecording()
      return
    }
    try {
      await startRecording()
    } catch (error) {
      const message =
        error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'NotFoundError')
          ? 'Necesito permiso del micrófono para escuchar tu nota.'
          : 'No pude abrir el micrófono. Revisa los permisos del navegador.'
      setVoiceError(message)
      onSoon(message)
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
          disabled={busy || voiceBusy}
          placeholder={
            phase === 'recording'
              ? 'Te estoy escuchando… toca de nuevo para terminar.'
              : placeholder
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            'w-full resize-none bg-transparent text-base leading-6 text-ink outline-none placeholder:text-slate-400 disabled:opacity-60 sm:text-[15px]',
            compact ? 'min-h-[52px]' : 'min-h-[84px]',
          )}
        />
        {phase === 'recording' || phase === 'transcribing' ? (
          <div className="mb-3">
            <AiWorkingState
              step={phase === 'recording' ? 'listening' : 'transcribing'}
              level={phase === 'recording' ? level : 0.45}
              startedAt={stepStartedAt}
            />
            {phase === 'recording' ? (
              <p className="mt-2 text-right text-xs text-muted">{elapsed.toFixed(1)}s</p>
            ) : null}
          </div>
        ) : null}
        {voiceError ? <p className="mb-2 text-xs text-danger">{voiceError}</p> : null}
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
                phase === 'recording' && 'bg-violet-100 text-violet-700',
                phase === 'transcribing' && 'bg-violet-50 text-violet-500',
              )}
              onClick={() => void handleVoice()}
              aria-label={phase === 'recording' ? 'Detener nota de voz' : 'Grabar nota de voz'}
              disabled={busy || phase === 'transcribing'}
            >
              {phase === 'recording' ? <Square size={16} /> : <Mic size={18} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={!value.trim() || busy || voiceBusy}
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
