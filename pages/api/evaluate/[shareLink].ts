import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { shareLink } = req.query

  if (typeof shareLink !== 'string') {
    return res.status(400).json({ error: 'Invalid share link' })
  }

  try {
    const { answers } = req.body

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Invalid answers format' })
    }

    // Get test with questions and correct answers
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

    if (!test.questions || test.questions.length === 0) {
      return res.status(400).json({ error: 'No questions found in test' })
    }

    // Calculate results based on question type
    const results = test.questions.map((question) => {
      const userAnswer = answers[question.id]
      let isCorrect = false
      
      let resultData: any = {
        questionId: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
      }

      if (question.questionType === 'multiple_choice') {
        const options = question.options ? JSON.parse(question.options) : []
        const userAnswerIndex = userAnswer !== undefined ? parseInt(userAnswer) : null
        isCorrect = userAnswerIndex !== null && userAnswerIndex === question.correctOptionIndex

        resultData.options = options
        resultData.correctOptionIndex = question.correctOptionIndex
        resultData.userAnswer = userAnswerIndex
      } else if (question.questionType === 'multiple_answer') {
        const options = question.options ? JSON.parse(question.options) : []
        const correctAnswers = question.correctAnswers ? JSON.parse(question.correctAnswers) : []
        const userAnswers = userAnswer ? JSON.parse(userAnswer) : []

        // Check if user selected all correct answers and no incorrect ones
        const userSet = new Set(userAnswers.map((a: any) => parseInt(a)))
        const correctSet = new Set(correctAnswers)
        isCorrect =
          userSet.size === correctSet.size &&
          Array.from(userSet).every((ans) => correctSet.has(ans))

        resultData.options = options
        resultData.correctAnswers = correctAnswers
        resultData.userAnswers = userAnswers.map((a: any) => parseInt(a))
      } else if (question.questionType === 'fill_blank') {
        const userText = userAnswer || ''
        const correctText = question.correctText || ''
        isCorrect = userText.trim().toLowerCase() === correctText.trim().toLowerCase()

        resultData.correctText = correctText
        resultData.userAnswer = userText
      }

      resultData.isCorrect = isCorrect
      return resultData
    })

    const correctCount = results.filter((r) => r.isCorrect).length
    const totalCount = results.length
    const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0

    return res.status(200).json({
      results,
      score: Math.round(score * 100) / 100,
      correctCount,
      totalCount,
    })
  } catch (error) {
    console.error('Error evaluating test:', error)
    return res.status(500).json({
      error: 'Failed to evaluate test',
    })
  }
}


