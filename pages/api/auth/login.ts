import type { NextApiRequest, NextApiResponse } from 'next'
import { loginUser } from '@/lib/auth/auth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email, password } = req.body
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  
  const result = await loginUser(email, password)
  
  if (!result.success) {
    return res.status(401).json({ error: result.error })
  }
  
  // Set session cookie
  res.setHeader('Set-Cookie', `session=${result.session!.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`)
  
  return res.status(200).json({
    success: true,
    user: result.user
  })
}





