import { commitmentQuestion, weeklySummaryBody } from '../server/push/copy.js'
import { cadenceFor, decidePushes, localClock } from '../server/push/decide.js'
import type { PushDevice } from '../server/push/types.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const question = commitmentQuestion('mañana pago el gym')
assert(question === '¿Pagaste el gym hoy?', `copy ${question}`)
assert(weeklySummaryBody(3, 4) === 'Avanzaste en 3 de 4 áreas. Toca para ver el detalle.', 'weekly copy')
assert(cadenceFor(0) === 'normal' && cadenceFor(3) === 'digest' && cadenceFor(6) === 'weekly', 'cadence steps')
console.log('ok  copy and cadence')

const caracas = 240
const checkIn = new Date('2026-09-19T20:05:00-04:00')
const clock = localClock(checkIn, caracas)
assert(clock.date === '2026-09-19', `local date ${clock.date}`)
assert(clock.hour === 20, `local hour ${clock.hour}`)

function device(partial: Partial<PushDevice>): PushDevice {
  return {
    id: 'dev',
    subscription: { endpoint: 'https://example.com/push', keys: { p256dh: 'x', auth: 'y' } },
    enabled: true,
    checkInHour: 20,
    timezoneOffsetMinutes: caracas,
    ignoredStreak: 0,
    notified: {},
    commitments: [{ id: 'cmp1', description: 'pago el gym', dueDate: '2026-09-19', status: 'pendiente' }],
    week: { weekStart: '2026-09-14', activeAreas: 3, totalAreas: 4, hadActivity: true },
    updatedAt: checkIn.toISOString(),
    ...partial,
  }
}

const pending = decidePushes(device({}), checkIn)
assert(pending.length === 1 && pending[0].kind === 'commitment', 'pending today')
assert(/gym/i.test(pending[0].body), pending[0].body)
console.log('ok  contextual commitment push')

const resolved = decidePushes(device({
  commitments: [{ id: 'cmp1', description: 'pago el gym', dueDate: '2026-09-19', status: 'cumplido' }],
}), checkIn)
assert(resolved.length === 0, 'resolved commitment is silent')

const duplicate = decidePushes(device({
  notified: { 'commitment:cmp1:2026-09-19': checkIn.toISOString() },
}), checkIn)
assert(duplicate.length === 0, 'no second push same day')
console.log('ok  no duplicate / resolved skip')

const digest = decidePushes(device({ ignoredStreak: 3 }), checkIn)
assert(digest.length === 1 && digest[0].kind === 'digest', 'digest after 3 ignored')

const weeklyOnly = decidePushes(device({ ignoredStreak: 6 }), checkIn)
assert(weeklyOnly.length === 0, 'weekday weekly-only sends nothing')

const sunday = new Date('2026-09-20T19:05:00-04:00')
const weekly = decidePushes(device({ ignoredStreak: 6 }), sunday)
assert(weekly.length === 1 && weekly[0].kind === 'weekly', 'sunday weekly survives')
assert(/3 de 4/.test(weekly[0].body), weekly[0].body)

const emptyWeek = decidePushes(device({
  week: { weekStart: '2026-09-14', activeAreas: 0, totalAreas: 4, hadActivity: false },
}), sunday)
assert(emptyWeek.every((item) => item.kind !== 'weekly'), 'no empty weekly')
console.log('ok  autorregulation and weekly gate')

console.log('\nfase 18 checks passed')
