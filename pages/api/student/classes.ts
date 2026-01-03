import type { NextApiResponse } from 'next'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Only students can access this
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students can access this endpoint' })
  }

  try {
    // Get student profile
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id }
    })

    if (!studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    // Get all enrolled classes
    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: studentProfile.id
      },
      include: {
        class: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            _count: {
              select: {
                enrollments: true
              }
            }
          }
        }
      },
      orderBy: {
        enrolledAt: 'desc'
      }
    })

    return res.status(200).json({ enrollments })
  } catch (error) {
    console.error('Error fetching enrolled classes:', error)
    return res.status(500).json({ error: 'Failed to fetch classes' })
  }
}

export default requireAuth(handler)

