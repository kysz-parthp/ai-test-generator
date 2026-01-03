import type { NextApiResponse } from 'next'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Only students can enroll
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students can enroll in classes' })
  }

  try {
    const { code } = req.body

    if (!code || code.trim().length === 0) {
      return res.status(400).json({ error: 'Join code is required' })
    }

    // Get student profile
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id }
    })

    if (!studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    // Find class by join code
    const classToJoin = await prisma.class.findUnique({
      where: { code: code.trim().toUpperCase() },
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
    })

    if (!classToJoin) {
      return res.status(404).json({ error: 'Invalid join code. Please check and try again.' })
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_classId: {
          studentId: studentProfile.id,
          classId: classToJoin.id
        }
      }
    })

    if (existingEnrollment) {
      return res.status(400).json({ error: 'You are already enrolled in this class' })
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: studentProfile.id,
        classId: classToJoin.id
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
            }
          }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: `Successfully joined ${classToJoin.name}`,
      enrollment: {
        id: enrollment.id,
        class: {
          id: classToJoin.id,
          name: classToJoin.name,
          description: classToJoin.description,
          teacher: {
            name: `${classToJoin.teacher.user.firstName} ${classToJoin.teacher.user.lastName}`
          }
        }
      }
    })
  } catch (error) {
    console.error('Error enrolling in class:', error)
    return res.status(500).json({ error: 'Failed to join class' })
  }
}

export default requireAuth(handler)

