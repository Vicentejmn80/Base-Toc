import { emptyFinanceBook, upsertAccount } from '../src/finance/domain/book'
import { applyFinanceClarification, interpretFinance } from '../src/finance'
import { commitParsedEvents } from '../src/finance/services/apply'
import { impliedRate } from '../src/finance/domain/currency'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function bookWith(name: string, currency: string) {
  return upsertAccount(emptyFinanceBook(), name, currency).book
}

const cases: Array<{
  id: string
  text: string
  book?: ReturnType<typeof emptyFinanceBook>
  expect: (result: ReturnType<typeof interpretFinance>) => void
}> = [
  {
    id: '1 income usd',
    text: 'Me pagaron 500 USD por un trabajo.',
    expect: (result) => {
      assert(result.kind === 'events', 'case 1 should parse')
      if (result.kind !== 'events') return
      assert(result.events[0].type === 'income', 'case 1 type')
      assert(result.events[0].amount === 500, 'case 1 amount')
      assert(result.events[0].currency === 'USD', 'case 1 currency')
    },
  },
  {
    id: '2 income usdt binance',
    text: 'Me pagaron 50 USDT por Binance.',
    expect: (result) => {
      assert(result.kind === 'events', 'case 2 should parse')
      if (result.kind !== 'events') return
      assert(result.events[0].type === 'income', 'case 2 type')
      assert(result.events[0].amount === 50, 'case 2 amount')
      assert(result.events[0].currency === 'USDT', 'case 2 currency')
      assert(/binance/i.test(result.events[0].accountHint ?? ''), 'case 2 account')
    },
  },
  {
    id: '3 transfer bank wise',
    text: 'Pasé 200 dólares de mi banco a Wise.',
    expect: (result) => {
      assert(result.kind === 'events', `case 3 should parse: ${JSON.stringify(result)}`)
      if (result.kind !== 'events') return
      assert(result.events[0].type === 'transfer', 'case 3 type')
      assert(result.events[0].amount === 200, 'case 3 amount')
      assert(result.events[0].currency === 'USD', 'case 3 currency')
      assert(/banco/i.test(result.events[0].accountHint ?? ''), 'case 3 source')
      assert(/wise/i.test(result.events[0].destinationAccountHint ?? ''), 'case 3 dest')
    },
  },
  {
    id: '4 exchange usdt ves',
    text: 'Cambié 50 USDT por 7.800 VES.',
    expect: (result) => {
      assert(result.kind === 'events', `case 4 should parse: ${JSON.stringify(result)}`)
      if (result.kind !== 'events') return
      const event = result.events[0]
      assert(event.type === 'exchange', 'case 4 type')
      assert(event.amount === 50, 'case 4 source amount')
      assert(event.currency === 'USDT', 'case 4 source currency')
      assert(event.destinationAmount === 7800, `case 4 dest amount ${event.destinationAmount}`)
      assert(event.destinationCurrency === 'VES', 'case 4 dest currency')
      assert(impliedRate(50, 7800) === 156, 'case 4 rate')
    },
  },
  {
    id: '5 expense food eur',
    text: 'Compré comida por 40 euros con mi tarjeta.',
    expect: (result) => {
      assert(result.kind === 'events', 'case 5 should parse')
      if (result.kind !== 'events') return
      assert(result.events[0].type === 'expense', 'case 5 type')
      assert(result.events[0].amount === 40, 'case 5 amount')
      assert(result.events[0].currency === 'EUR', 'case 5 currency')
      assert(result.events[0].category === 'food', 'case 5 category')
      assert(/tarjeta/i.test(result.events[0].accountHint ?? ''), 'case 5 account')
    },
  },
  {
    id: '6 fee',
    text: 'Me cobraron 5 dólares de comisión.',
    expect: (result) => {
      assert(result.kind === 'events', 'case 6 should parse')
      if (result.kind !== 'events') return
      assert(result.events[0].type === 'fee', 'case 6 type')
      assert(result.events[0].amount === 5, 'case 6 amount')
      assert(result.events[0].currency === 'USD', 'case 6 currency')
    },
  },
  {
    id: '7 refund',
    text: 'Me devolvieron 20 dólares de una compra.',
    expect: (result) => {
      assert(result.kind === 'events', 'case 7 should parse')
      if (result.kind !== 'events') return
      assert(result.events[0].type === 'refund', 'case 7 type')
      assert(result.events[0].amount === 20, 'case 7 amount')
      assert(result.events[0].currency === 'USD', 'case 7 currency')
    },
  },
  {
    id: '8 compound income + transfer',
    text: 'Hoy cobré 500 euros por Revolut, después pasé 200 a mi cuenta bancaria.',
    expect: (result) => {
      assert(result.kind === 'events', `case 8 should parse: ${JSON.stringify(result)}`)
      if (result.kind !== 'events') return
      assert(result.events.length === 2, `case 8 count ${result.events.length}`)
      assert(result.events[0].type === 'income', 'case 8 income')
      assert(result.events[0].amount === 500, 'case 8 income amount')
      assert(result.events[0].currency === 'EUR', 'case 8 income currency')
      assert(/revolut/i.test(result.events[0].accountHint ?? ''), 'case 8 revolut')
      assert(result.events[1].type === 'transfer', 'case 8 transfer')
      assert(result.events[1].amount === 200, 'case 8 transfer amount')
      assert(result.events[1].currency === 'EUR', 'case 8 inherited currency')
    },
  },
  {
    id: '9 needs clarification',
    text: 'Vendí 100 de la moneda que tengo en Binance y recibí 15.000 en mi moneda local.',
    book: bookWith('Binance', 'USDT'),
    expect: (result) => {
      assert(result.kind === 'needs_clarification', `case 9 should ask: ${JSON.stringify(result)}`)
    },
  },
]

let failed = 0
for (const item of cases) {
  const result = interpretFinance(item.text, item.book ?? emptyFinanceBook())
  try {
    item.expect(result)
    console.log(`ok  ${item.id}`)
  } catch (error) {
    failed += 1
    console.error(`fail ${item.id}: ${(error as Error).message}`)
    console.error(JSON.stringify(result, null, 2))
  }
}

const unclear = interpretFinance('Vendí unos dólares.', emptyFinanceBook())
if (unclear.kind !== 'needs_clarification') {
  failed += 1
  console.error('fail missing-amount should ask')
} else {
  console.log('ok  missing amount asks')
}

const clarified = applyFinanceClarification('Vendí unos dólares.', '50 USD', emptyFinanceBook(), unclear.kind === 'needs_clarification' ? unclear.partial : [])
if (clarified.kind !== 'events' || clarified.events[0].amount !== 50 || clarified.events[0].currency !== 'USD') {
  failed += 1
  console.error('fail clarification merge', clarified)
} else {
  console.log('ok  clarification merge')
}

const committed = commitParsedEvents(
  emptyFinanceBook(),
  'ws_test',
  [
    { type: 'income', amount: 50, currency: 'USDT', accountHint: 'Binance', description: 'cobro' },
    { type: 'exchange', amount: 50, currency: 'USDT', accountHint: 'Binance', destinationAmount: 7800, destinationCurrency: 'VES', description: 'cambio' },
  ],
)
const income = committed.events.find((event) => event.type === 'income')
const exchange = committed.events.find((event) => event.type === 'exchange')
if (!income || !exchange || exchange.sourceEventId !== income.id || exchange.impliedRate !== 156) {
  failed += 1
  console.error('fail persist relation/rate', committed.events)
} else {
  console.log('ok  persist group + implied rate')
}

if (failed) {
  console.error(`\n${failed} finance cases failed`)
  process.exit(1)
}
console.log('\nall finance cases passed')
