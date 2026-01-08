import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { shareLink } = req.query

  if (typeof shareLink !== 'string') {
    return res.status(400).json({ error: 'Invalid share link' })
  }

  try {
    const test = await prisma.test.findUnique({
      where: { shareLink },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!test) {
      return res.status(404).json({ error: 'Test not found' })
    }

    // Always return file information
    const responseData: any = {
      id: test.id,
      title: test.title,
      shareLink: test.shareLink,
      createdAt: test.createdAt,
      originalFileName: test.originalFileName,
      filePath: test.filePath,
    }

    // If test has questions, also return them
    if (test.questions && test.questions.length > 0) {
      const questions = test.questions.map((q) => {
        const baseQuestion: any = {
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          order: q.order,
        }

        // Preserve original structure
        if (q.originalNumber) {
          baseQuestion.originalNumber = q.originalNumber
        }
        if (q.section) {
          baseQuestion.section = q.section
        }

        if (q.imageUrl) {
          baseQuestion.imageUrl = q.imageUrl
        }

        if (q.questionType === 'multiple_choice' || q.questionType === 'multiple_answer') {
          baseQuestion.options = q.options ? JSON.parse(q.options) : []
          if (q.questionType === 'multiple_choice') {
            baseQuestion.correctOptionIndex = q.correctOptionIndex
          } else {
            baseQuestion.correctAnswers = q.correctAnswers ? JSON.parse(q.correctAnswers) : []
          }
        } else if (q.questionType === 'fill_blank') {
          baseQuestion.correctText = q.correctText
        } else if (q.questionType === 'descriptive') {
          // For descriptive questions, correctText contains sample answer if provided
          if (q.correctText) {
            baseQuestion.sampleAnswer = q.correctText
          }
        } else if (q.questionType === 'true_false') {
          // For true/false questions, return the correct answer
          baseQuestion.correctAnswer = q.correctAnswer
        } else if (q.questionType === 'matching') {
          // For matching questions, parse matching pairs
          if (q.matchingPairs) {
            const pairs = JSON.parse(q.matchingPairs)
            baseQuestion.leftColumn = pairs.map((p: any) => p.left)
            baseQuestion.rightColumn = pairs.map((p: any) => p.right).filter((r: string) => r)
          }
          if (q.correctMatches) {
            baseQuestion.correctMatches = JSON.parse(q.correctMatches)
          }
        } else if (q.questionType === 'composite') {
          // Composite questions have both MCQ and fill-in parts
          baseQuestion.options = q.options ? JSON.parse(q.options) : []
          baseQuestion.correctOptionIndex = q.correctOptionIndex
          baseQuestion.hasFillInPart = q.hasFillInPart || false
          baseQuestion.fillInPrompt = q.fillInPrompt
          baseQuestion.fillInCorrectText = q.correctText
        } else if (q.questionType === 'sequencing') {
          // For sequencing questions, options contains items to sequence
          baseQuestion.items = q.options ? JSON.parse(q.options) : []
          if (q.correctOrder) {
            baseQuestion.correctOrder = JSON.parse(q.correctOrder)
          }
        }

        return baseQuestion
      })

      responseData.questions = questions
    }

    return res.status(200).json(responseData)
  } catch (error) {
    console.error('Error fetching test:', error)
    return res.status(500).json({
      error: 'Failed to fetch test',
    })
  }
}

