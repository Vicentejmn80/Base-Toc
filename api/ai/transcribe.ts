import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond.js'
import { handleTranscribe } from '../../server/handlers/transcribe.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleTranscribe)
}
