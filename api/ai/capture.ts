import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond.ts'
import { handleCapture } from '../../server/handlers/capture.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleCapture)
}
