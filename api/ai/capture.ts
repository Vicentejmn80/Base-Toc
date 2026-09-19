import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond'
import { handleCapture } from '../../server/handlers/capture'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleCapture)
}
