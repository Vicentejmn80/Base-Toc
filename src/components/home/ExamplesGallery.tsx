import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Activity,
  Apple,
  BookOpen,
  Briefcase,
  Building2,
  Dumbbell,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import type { ExampleCard } from '../../data/exampleGallery'

const iconByType: Record<ExampleCard['icon'], LucideIcon> = {
  building: Building2,
  activity: Activity,
  wallet: Wallet,
  sparkles: Sparkles,
  briefcase: Briefcase,
  book: BookOpen,
  apple: Apple,
  dumbbell: Dumbbell,
}

interface ExamplesGalleryProps {
  examples: ExampleCard[]
  onCreate: (prompt: string) => void
  onCustomize: (prompt: string) => void
  defaultCollapsed?: boolean
}

export function ExamplesGallery({
  examples,
  onCreate,
  onCustomize,
  defaultCollapsed = false,
}: ExamplesGalleryProps) {
  const [selected, setSelected] = useState<ExampleCard | null>(null)
  const [open, setOpen] = useState(!defaultCollapsed)

  return (
    <section className="mt-12">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mb-4 flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="type-section">Explora ejemplos</h2>
          <p className="type-meta mt-1">
            Mira casos de uso antes de crear tu espacio.
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={open ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
        {examples.map((example) => {
          const Icon = iconByType[example.icon]
          return (
            <button
              key={example.id}
              type="button"
              onClick={() => setSelected(example)}
              className="rounded-2xl border border-line bg-white p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-slate-300"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-soft text-slate-700">
                <Icon size={17} />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{example.title}</p>
              <p className="mt-1 text-sm text-muted">{example.description}</p>
            </button>
          )
        })}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        wide
        title={selected?.title ?? 'Preview'}
        description={selected?.description}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (!selected) return
                onCustomize(selected.prompt)
                setSelected(null)
              }}
            >
              Personalizarlo
            </Button>
            <Button
              onClick={() => {
                if (!selected) return
                onCreate(selected.prompt)
                setSelected(null)
              }}
            >
              Crear este espacio
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {selected.metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-xl border border-line bg-canvas px-3 py-3"
                >
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{metric.value}</p>
                </article>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-canvas text-xs text-muted">
                    <tr>
                      {selected.tableColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-medium">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.tableRows.map((row, index) => (
                      <tr key={`${selected.id}_${index}`} className="border-t border-line">
                        {row.map((cell, i) => (
                          <td key={`${selected.id}_${index}_${i}`} className="px-3 py-2.5">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
