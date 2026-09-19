import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePushConfig } from '../../server/push/handlers.js'
import { errorMessage, errorStatus } from '../../server/handlers/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    return res.status(200).json(await handlePushConfig())
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
}
