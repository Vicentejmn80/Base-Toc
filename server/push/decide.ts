import { commitmentQuestion, digestBody, weeklySummaryBody } from './copy.js'
import {
  DEFAULT_CHECK_IN_HOUR,
  DIGEST_AFTER_IGNORED,
  WEEKLY_HOUR,
  WEEKLY_ONLY_AFTER_IGNORED,
  type PushCadence,
  type PushDevice,
  type PushMessage,
} from './types.js'

export function cadenceFor(ignoredStreak: number): PushCadence {
  if (ignoredStreak >= WEEKLY_ONLY_AFTER_IGNORED) return 'weekly'
  if (ignoredStreak >= DIGEST_AFTER_IGNORED) return 'digest'
  return 'normal'
}

export function localClock(now: Date, timezoneOffsetMinutes: number) {
  const shifted = new Date(now.getTime() - timezoneOffsetMinutes * 60_000)
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  }
}

export function nextIgnoredStreak(device: PushDevice) {
  if (!device.lastPushAt) return device.ignoredStreak
  const lastPush = Date.parse(device.lastPushAt)
  const lastOpen = device.lastOpenedAt ? Date.parse(device.lastOpenedAt) : 0
  if (lastOpen >= lastPush) return 0
  return device.ignoredStreak + 1
}

function alreadySent(device: PushDevice, key: string) {
  return Boolean(device.notified[key])
}

export function decidePushes(device: PushDevice, now: Date): PushMessage[] {
  if (!device.enabled || !device.subscription) return []

  const clock = localClock(now, device.timezoneOffsetMinutes)
  const cadence = cadenceFor(device.ignoredStreak)
  const checkInHour = device.checkInHour || DEFAULT_CHECK_IN_HOUR
  const atCheckIn = clock.hour === checkInHour
  const atWeekly = clock.weekday === 0 && clock.hour === WEEKLY_HOUR
  const messages: PushMessage[] = []

  if (atCheckIn && cadence !== 'weekly') {
    const pending = device.commitments.filter(
      (item) => item.status === 'pendiente' && item.dueDate === clock.date,
    )
    if (cadence === 'digest') {
      const key = `digest:${clock.date}`
      if (pending.length && !alreadySent(device, key)) {
        messages.push({
          kind: 'digest',
          title: 'Compromisos de hoy',
          body: digestBody(pending.map((item) => item.description)),
          url: '/',
          tag: key,
        })
      }
    } else {
      for (const item of pending) {
        const key = `commitment:${item.id}:${clock.date}`
        if (alreadySent(device, key)) continue
        messages.push({
          kind: 'commitment',
          title: 'Compromiso de hoy',
          body: commitmentQuestion(item.description),
          url: '/',
          tag: key,
        })
      }
    }
  }

  if (atWeekly) {
    const week = device.week
    const key = week ? `weekly:${week.weekStart}` : `weekly:${clock.date}`
    if (week?.hadActivity && week.totalAreas > 0 && !alreadySent(device, key) && device.lastWeeklyWeek !== week.weekStart) {
      messages.push({
        kind: 'weekly',
        title: 'Tu semana',
        body: weeklySummaryBody(week.activeAreas, week.totalAreas),
        url: '/progress',
        tag: key,
      })
    }
  }

  return messages
}
