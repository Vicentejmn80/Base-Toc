import { useState } from 'react'
import { normalizeCurrencyCode } from '../../finance/domain/currency'
import { emptyFinanceBook, inferAccountKind, upsertAccount } from '../../finance/domain/book'
import type { FinanceBook } from '../../finance/domain/types'
import { Button } from '../ui/Button'

interface FinanceOnboardingProps {
  book?: FinanceBook
  onComplete: (book: FinanceBook) => void
}

const STEPS = [
  { id: 'country', title: '¿En qué país estás?', hint: 'Cualquiera. Esto solo da contexto.' },
  { id: 'display', title: '¿En qué moneda quieres ver principalmente tu progreso?', hint: 'USD, EUR, VES… o la que uses.' },
  { id: 'extras', title: '¿Qué otras monedas manejas normalmente?', hint: 'Opcional. Sepáralas con coma.' },
  { id: 'accounts', title: '¿Dónde suele estar tu dinero?', hint: 'Banco, efectivo, wallet, exchange… escribe el nombre.' },
] as const

export function FinanceOnboarding({ book, onComplete }: FinanceOnboardingProps) {
  const [step, setStep] = useState(0)
  const [country, setCountry] = useState(book?.setup.country ?? '')
  const [display, setDisplay] = useState(book?.setup.displayCurrency ?? '')
  const [extras, setExtras] = useState((book?.setup.extraCurrencies ?? []).join(', '))
  const [accountName, setAccountName] = useState('')
  const [accounts, setAccounts] = useState(book?.accounts ?? [])

  function addAccount() {
    const name = accountName.trim()
    if (!name) return
    const currency = normalizeCurrencyCode(display) ?? 'XXX'
    const next = upsertAccount(
      { ...(book ?? emptyFinanceBook()), accounts },
      name,
      currency,
      inferAccountKind(name),
    )
    setAccounts(next.book.accounts)
    setAccountName('')
  }

  function finish() {
    const displayCurrency = normalizeCurrencyCode(display)
    const extraCurrencies = extras
      .split(/[,/]+/)
      .map((item) => normalizeCurrencyCode(item.trim()))
      .filter((item): item is string => Boolean(item))
    onComplete({
      setup: {
        complete: true,
        country: country.trim() || undefined,
        displayCurrency,
        extraCurrencies,
      },
      accounts,
      events: book?.events ?? [],
      categories: book?.categories ?? emptyFinanceBook().categories,
    })
  }

  const current = STEPS[step]

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-card)]" data-testid="finance-onboarding">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Finanzas</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">{current.title}</h2>
      <p className="mt-1 text-sm text-muted">{current.hint}</p>

      {step === 0 ? (
        <input
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="País"
          className="mt-4 min-h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-slate-400"
        />
      ) : null}

      {step === 1 ? (
        <input
          value={display}
          onChange={(event) => setDisplay(event.target.value)}
          placeholder="Moneda principal"
          className="mt-4 min-h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-slate-400"
        />
      ) : null}

      {step === 2 ? (
        <input
          value={extras}
          onChange={(event) => setExtras(event.target.value)}
          placeholder="Otras monedas, opcional"
          className="mt-4 min-h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-slate-400"
        />
      ) : null}

      {step === 3 ? (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Nombre de la cuenta o institución"
              className="min-h-11 flex-1 rounded-2xl border border-line px-3 text-sm outline-none focus:border-slate-400"
              onKeyDown={(event) => {
                if (event.key === 'Enter') addAccount()
              }}
            />
            <Button variant="secondary" onClick={addAccount} disabled={!accountName.trim()}>
              Añadir
            </Button>
          </div>
          {accounts.length ? (
            <ul className="space-y-1 text-sm text-ink">
              {accounts.map((account) => (
                <li key={account.id}>
                  {account.name}
                  <span className="text-muted"> · {account.type}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !display.trim()}
          >
            Seguir
          </Button>
        ) : (
          <Button onClick={finish}>Listo</Button>
        )}
      </div>
    </section>
  )
}
