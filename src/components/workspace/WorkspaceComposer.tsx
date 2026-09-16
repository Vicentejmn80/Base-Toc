import { useState } from 'react'
import type { Workspace } from '../../domain/types'
import { runCommand, SUGGESTED_COMMANDS } from '../../interpretation/commands'
import { PromptBox } from '../home/PromptBox'
import { useToast } from '../../state/toast'

interface WorkspaceComposerProps {
  workspace: Workspace
}

export function WorkspaceComposer({ workspace }: WorkspaceComposerProps) {
  const { showToast } = useToast()
  const [value, setValue] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [matched, setMatched] = useState(true)
  const suggestions = SUGGESTED_COMMANDS[workspace.kind]

  function ask(question: string) {
    const result = runCommand(question, workspace)
    setValue(question)
    setAnswer(result.answer)
    setMatched(result.matched)
  }

  return (
    <section className="ai-accent rounded-3xl p-4 shadow-[var(--shadow-card)] sm:p-5">
      <p className="ai-label mb-3 text-sm font-semibold">Pregunta algo sobre tus datos</p>
      <PromptBox
        compact
        value={value}
        voiceScope={workspace.kind}
        placeholder="Pregunta algo sobre tus datos..."
        onChange={setValue}
        onSubmit={() => ask(value)}
        onVoiceTranscript={(text) => ask(text)}
        onSoon={(message) => showToast(message)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => ask(item)}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink"
          >
            {item}
          </button>
        ))}
      </div>
      {answer ? (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${matched ? 'bg-canvas text-ink' : 'bg-amber-50 text-amber-900'}`}>
          {answer}
        </div>
      ) : null}
    </section>
  )
}
