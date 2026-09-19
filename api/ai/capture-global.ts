import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond.js'
import { handleCaptureGlobal } from '../../server/handlers/captureGlobal.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleCaptureGlobal)
}
