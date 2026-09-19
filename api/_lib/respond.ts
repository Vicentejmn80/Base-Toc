import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorMessage, errorStatus } from '../../server/handlers/http'

export async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  run: (body: unknown) => Promise<unknown>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await run(req.body ?? {})
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api]', error instanceof Error ? error.stack || error.message : error)
    const status = errorStatus(error)
    return res.status(status).json({
      error: errorMessage(error),
      code: error instanceof Error ? error.name : 'Error',
    })
  }
}
