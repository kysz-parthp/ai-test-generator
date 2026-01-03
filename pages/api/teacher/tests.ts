import type { NextApiResponse } from 'next'
import { requireTeacher, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Get teacher profile
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: req.user.id }
    })
    
    if (!teacherProfile) {
      return res.status(404).json({ error: 'Teacher profile not found' })
    }
    
    // Get all tests created by this teacher
    const tests = await prisma.test.findMany({
      where: {
        teacherId: teacherProfile.id
      },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return res.status(200).json({ tests })
  } catch (error) {
    console.error('Error fetching tests:', error)
    return res.status(500).json({ error: 'Failed to fetch tests' })
  }
}

export default requireTeacher(handler)
