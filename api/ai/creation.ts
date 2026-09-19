import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePost } from '../_lib/respond.js'
import { handleCreation } from '../../server/handlers/creation.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePost(req, res, handleCreation)
}
