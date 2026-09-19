import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond.js'
import { handlePushSubscribe } from '../../server/push/handlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handlePushSubscribe)
}
