import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleCronPush } from '../../server/push/handlers.js'
import { errorMessage, errorStatus } from '../../server/handlers/http.js'

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  try {
    const result = await handleCronPush({
      authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      secret: queryString(req.query.secret) || (typeof body.secret === 'string' ? body.secret : undefined),
      at: queryString(req.query.at) || (typeof body.at === 'string' ? body.at : undefined),
    })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: errorMessage(error) })
  }
}
