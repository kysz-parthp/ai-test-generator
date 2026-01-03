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

    // Get all classes the student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: studentProfile.id
      },
      select: {
        classId: true
      }
    })

    const classIds = enrollments.map(e => e.classId)

    // Get all test assignments for those classes
    const assignments = await prisma.testAssignment.findMany({
      where: {
        classId: { in: classIds },
        isActive: true
      },
      include: {
        test: {
          include: {
            _count: {
              select: {
                questions: true
              }
            }
          }
        },
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
            }
          }
        }
      },
      orderBy: {
        assignedAt: 'desc'
      }
    })

    // Check if student has attempted each test
    const assignmentsWithAttempts = await Promise.all(
      assignments.map(async (assignment) => {
        const attempts = await prisma.testAttempt.findMany({
          where: {
            testId: assignment.testId,
            studentId: studentProfile.id
          },
          orderBy: {
            attemptNumber: 'desc'
          },
          take: 1
        })

        return {
          ...assignment,
          latestAttempt: attempts[0] || null
        }
      })
    )

    return res.status(200).json({ assignments: assignmentsWithAttempts })
  } catch (error) {
    console.error('Error fetching assigned tests:', error)
    return res.status(500).json({ error: 'Failed to fetch assigned tests' })
  }
}

export default requireAuth(handler)

