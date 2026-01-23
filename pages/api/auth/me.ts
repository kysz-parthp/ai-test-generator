import type { NextApiResponse } from 'next'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/authMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  return res.status(200).json({ user: req.user })
}

export default requireAuth(handler)





