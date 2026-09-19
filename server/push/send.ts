import { createRequire } from 'node:module'
import { deleteDevice } from './store.js'
import type { PushDevice, PushMessage, PushSubscriptionJSON } from './types.js'

const require = createRequire(import.meta.url)
const webpush = require('web-push') as typeof import('web-push')

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null
}

export function pushConfigured() {
  return configured()
}

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.')
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:push@basetoc.app', publicKey, privateKey)
}

export async function sendPush(subscription: PushSubscriptionJSON, message: PushMessage) {
  ensureVapid()
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
    JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url,
      kind: message.kind,
      tag: message.tag,
    }),
    { TTL: message.kind === 'weekly' ? 60 * 60 * 24 : 60 * 60 * 8, urgency: 'normal' },
  )
}

export function isLocalSubscription(subscription: PushSubscriptionJSON | null) {
  return Boolean(subscription?.endpoint.startsWith('local:'))
}

export async function sendToDevice(device: PushDevice, messages: PushMessage[]) {
  if (!device.subscription || !messages.length) return { sent: 0, gone: false }
  if (isLocalSubscription(device.subscription)) {
    return { sent: messages.length, gone: false }
  }
  let gone = false
  let sent = 0
  for (const message of messages) {
    try {
      await sendPush(device.subscription, message)
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        gone = true
        break
      }
      console.error('[push] send failed', error)
    }
  }
  if (gone) await deleteDevice(device.id)
  return { sent, gone }
}
