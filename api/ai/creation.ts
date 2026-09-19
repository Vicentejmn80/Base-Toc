import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond'
import { handleCreation } from '../../server/handlers/creation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleCreation)
}
