import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond'
import { handleAnalyze } from '../../server/handlers/analyze'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleAnalyze)
}
