import type { NextApiResponse } from 'next'
import { requireTeacher, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { testId, classId, dueDate } = req.body

    if (!testId || !classId) {
      return res.status(400).json({ error: 'Test ID and Class ID are required' })
    }

    // Get teacher profile
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: req.user.id }
    })

    if (!teacherProfile) {
      return res.status(404).json({ error: 'Teacher profile not found' })
    }

    // Verify test belongs to this teacher
    const test = await prisma.test.findUnique({
      where: { id: testId }
    })

    if (!test) {
      return res.status(404).json({ error: 'Test not found' })
    }

    if (test.teacherId !== teacherProfile.id) {
      return res.status(403).json({ error: 'You can only assign your own tests' })
    }

    // Verify class belongs to this teacher
    const classToAssign = await prisma.class.findUnique({
      where: { id: classId }
    })

    if (!classToAssign) {
      return res.status(404).json({ error: 'Class not found' })
    }

    if (classToAssign.teacherId !== teacherProfile.id) {
      return res.status(403).json({ error: 'You can only assign to your own classes' })
    }

    // Check if already assigned
    const existingAssignment = await prisma.testAssignment.findUnique({
      where: {
        testId_classId: {
          testId,
          classId
        }
      }
    })

    if (existingAssignment) {
      return res.status(400).json({ error: 'Test is already assigned to this class' })
    }

    // Create assignment
    const assignment = await prisma.testAssignment.create({
      data: {
        testId,
        classId,
        dueDate: dueDate ? new Date(dueDate) : null,
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
            _count: {
              select: {
                enrollments: true
              }
            }
          }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: `Test assigned to ${classToAssign.name}`,
      assignment
    })
  } catch (error) {
    console.error('Error assigning test:', error)
    return res.status(500).json({ error: 'Failed to assign test' })
  }
}

export default requireTeacher(handler)

