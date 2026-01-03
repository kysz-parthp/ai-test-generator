import type { NextApiResponse } from 'next'
import { requireTeacher, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

// Generate a unique 6-character join code
function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Get teacher profile
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: req.user.id }
  })
  
  if (!teacherProfile) {
    return res.status(404).json({ error: 'Teacher profile not found' })
  }

  // GET - List all classes
  if (req.method === 'GET') {
    try {
      const classes = await prisma.class.findMany({
        where: {
          teacherId: teacherProfile.id
        },
        include: {
          _count: {
            select: {
              enrollments: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      return res.status(200).json({ classes })
    } catch (error) {
      console.error('Error fetching classes:', error)
      return res.status(500).json({ error: 'Failed to fetch classes' })
    }
  }

  // POST - Create new class
  if (req.method === 'POST') {
    try {
      const { name, description } = req.body
      
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Class name is required' })
      }
      
      // Generate unique join code
      let joinCode = generateJoinCode()
      let isUnique = false
      let attempts = 0
      
      // Ensure join code is unique (try up to 10 times)
      while (!isUnique && attempts < 10) {
        const existing = await prisma.class.findUnique({
          where: { code: joinCode }
        })
        
        if (!existing) {
          isUnique = true
        } else {
          joinCode = generateJoinCode()
          attempts++
        }
      }
      
      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate unique join code' })
      }
      
      // Create class
      const newClass = await prisma.class.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          code: joinCode,
          teacherId: teacherProfile.id
        },
        include: {
          _count: {
            select: {
              enrollments: true
            }
          }
        }
      })
      
      return res.status(201).json({ 
        success: true,
        class: newClass 
      })
    } catch (error) {
      console.error('Error creating class:', error)
      return res.status(500).json({ error: 'Failed to create class' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default requireTeacher(handler)

