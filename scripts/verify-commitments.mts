import { interpretCommitment, leftoverAfterCommitments, parseDueDate, suggestWorkspaceId, groupPendingCommitments } from '../src/lib/commitment'
import type { Commitment, Workspace } from '../src/domain/types'

const today = new Date('2026-09-19T12:00:00')

const workspaces = [
  { id: 'fin', name: 'Finanzas personales', kind: 'finance', description: '', icon: 'wallet', color: '#0F766E', createdAt: '', updatedAt: '', fields: [], records: [], goals: [] },
  { id: 'run', name: 'Running', kind: 'fitness', description: '', icon: 'activity', color: '#C2410C', createdAt: '', updatedAt: '', fields: [], records: [], goals: [] },
  { id: 'hab', name: 'Lectura', kind: 'habits', description: '', icon: 'sparkles', color: '#7C3AED', createdAt: '', updatedAt: '', fields: [], records: [], goals: [] },
] as Workspace[]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const gym = interpretCommitment('mañana pago el gym', workspaces, today)
assert(gym.kind === 'commitments', `gym should parse: ${JSON.stringify(gym)}`)
if (gym.kind === 'commitments') {
  assert(gym.items[0].dueDate === '2026-09-20', `gym date ${gym.items[0].dueDate}`)
  assert(/gym/i.test(gym.items[0].description), gym.items[0].description)
  assert(gym.items[0].suggestedWorkspaceId === 'fin', `gym space ${gym.items[0].suggestedWorkspaceId}`)
}
console.log('ok  gym tomorrow → finance')

const quiz = interpretCommitment('el jueves tengo quiz de matemática', workspaces, today)
assert(quiz.kind === 'commitments', `quiz should parse: ${JSON.stringify(quiz)}`)
if (quiz.kind === 'commitments') {
  assert(quiz.items[0].dueDate === '2026-09-24', `quiz date ${quiz.items[0].dueDate}`)
  assert(/quiz/i.test(quiz.items[0].description), quiz.items[0].description)
  assert(!quiz.items[0].suggestedWorkspaceId, 'quiz should not invent a space')
}
console.log('ok  thursday quiz → no space')

const mixed = interpretCommitment('Corrí 10 km y mañana pago el gym', workspaces, today)
assert(mixed.kind === 'commitments', `mixed ${JSON.stringify(mixed)}`)
assert(leftoverAfterCommitments('Corrí 10 km y mañana pago el gym').toLowerCase().includes('corr'), 'leftover past event')
console.log('ok  mixed note splits commitment from past event')

const unclear = interpretCommitment('pagué el gym mañana', workspaces, today)
assert(unclear.kind === 'needs_clarification', `ambiguous ${JSON.stringify(unclear)}`)
console.log('ok  past+future asks')

const missingDate = interpretCommitment('tengo que pagar el gym', workspaces, today)
assert(missingDate.kind === 'needs_clarification', `missing date ${JSON.stringify(missingDate)}`)
console.log('ok  missing date asks')

assert(parseDueDate('el viernes', today) === '2026-09-25', `viernes ${parseDueDate('el viernes', today)}`)
assert(suggestWorkspaceId('pagar el gym', workspaces) === 'fin', 'suggest gym')
assert(suggestWorkspaceId('quiz de matemática', workspaces) === undefined, 'quiz not forced')

const past = interpretCommitment('Hoy corrí 10 km', workspaces, today)
assert(past.kind === 'unparsed', 'past run is not a commitment')
console.log('ok  past event is not a commitment')

const grouped = groupPendingCommitments(
  [
    { id: 'a', description: 'Ayer', dueDate: '2026-09-18', status: 'pendiente', createdAt: '' },
    { id: 'b', description: 'Hoy', dueDate: '2026-09-19', status: 'pendiente', createdAt: '' },
    { id: 'c', description: 'Mañana gym', dueDate: '2026-09-20', status: 'pendiente', createdAt: '' },
    { id: 'd', description: 'Lejos', dueDate: '2026-10-20', status: 'pendiente', createdAt: '' },
    { id: 'e', description: 'Hecho', dueDate: '2026-09-19', status: 'cumplido', createdAt: '' },
  ] as Commitment[],
  today,
)
assert(grouped.overdue.map((item) => item.id).join() === 'a', 'overdue')
assert(grouped.today.map((item) => item.id).join() === 'b', 'today')
assert(grouped.upcoming.map((item) => item.id).join() === 'c', 'upcoming next 7 days')
console.log('ok  overdue / today / upcoming buckets')

console.log('\nall commitment cases passed')
