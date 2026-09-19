import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePushInbox } from '../../server/push/handlers.js'
import { errorMessage, errorStatus } from '../../server/handlers/http.js'

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const result = await handlePushInbox(queryString(req.query.deviceId) || '')
    return res.status(200).json(result)
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
}
