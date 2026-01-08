import { NextApiRequest, NextApiResponse } from 'next'
import { verifySession } from './auth'

export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string
    email: string
    role: string
    firstName: string
    lastName: string
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const token = req.cookies.session || req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const user = await verifySession(token)
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    
    ;(req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    }
    
    return handler(req as AuthenticatedRequest, res)
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) => {
    return requireAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      
      return handler(req, res)
    })
  }
}

/**
 * Middleware to require teacher role
 */
export const requireTeacher = requireRole('TEACHER', 'ADMIN')

/**
 * Middleware to require student role
 */
export const requireStudent = requireRole('STUDENT', 'TEACHER', 'ADMIN')



