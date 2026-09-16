import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond.ts'
import { handleCaptureGlobal } from '../../server/handlers/captureGlobal.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleCaptureGlobal)
}
