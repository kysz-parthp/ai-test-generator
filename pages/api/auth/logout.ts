import type { NextApiRequest, NextApiResponse } from 'next'
import { logout } from '@/lib/auth/auth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const token = req.cookies.session
  
  if (token) {
    await logout(token)
  }
  
  // Clear session cookie
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0')
  
  return res.status(200).json({ success: true })
}





