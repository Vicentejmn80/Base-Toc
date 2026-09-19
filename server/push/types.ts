export type PushCadence = 'normal' | 'digest' | 'weekly'

export interface PushSubscriptionJSON {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushCommitment {
  id: string
  description: string
  dueDate: string
  status: string
}

export interface PushWeekSnapshot {
  weekStart: string
  activeAreas: number
  totalAreas: number
  hadActivity: boolean
}

export interface PushDevice {
  id: string
  subscription: PushSubscriptionJSON | null
  enabled: boolean
  checkInHour: number
  timezoneOffsetMinutes: number
  ignoredStreak: number
  lastOpenedAt?: string
  lastPushAt?: string
  lastWeeklyWeek?: string
  notified: Record<string, string>
  commitments: PushCommitment[]
  week: PushWeekSnapshot | null
  inbox: PushMessage[]
  updatedAt: string
}

export interface PushMessage {
  kind: 'commitment' | 'digest' | 'weekly'
  title: string
  body: string
  url: string
  tag: string
}

export const PUSH_STORE_KEY = 'push:devices'
export const DEFAULT_CHECK_IN_HOUR = 20
export const WEEKLY_HOUR = 19
export const DIGEST_AFTER_IGNORED = 3
export const WEEKLY_ONLY_AFTER_IGNORED = 6
