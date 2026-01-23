import type { NextApiRequest, NextApiResponse } from 'next'
import { registerUser } from '@/lib/auth/auth'
import { z } from 'zod'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['STUDENT', 'TEACHER'])
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const data = RegisterSchema.parse(req.body)
    const result = await registerUser(data)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }
    
    // Set session cookie
    res.setHeader('Set-Cookie', `session=${result.session!.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`)
    
    return res.status(200).json({
      success: true,
      user: result.user
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Registration error:', error)
    return res.status(500).json({ error: 'Registration failed' })
  }
}





