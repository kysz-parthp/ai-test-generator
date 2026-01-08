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
        // Case-insensitive comparison, trim whitespace
        isCorrect =
          userText.trim().toLowerCase() === correctText.trim().toLowerCase()

        resultData.correctText = correctText
        resultData.userAnswer = userText
      } else if (question.questionType === 'descriptive') {
        // Descriptive questions are not auto-graded
        // Store the user's answer and sample answer if available
        const userText = userAnswer || ''
        const sampleAnswer = question.correctText || null // Reused field for sample answer
        
        // Descriptive questions are always marked as "correct" for display purposes
        // (they require manual grading)
        isCorrect = true

        resultData.userAnswer = userText
        if (sampleAnswer) {
          resultData.sampleAnswer = sampleAnswer
        }
      } else if (question.questionType === 'true_false') {
        // True/False questions
        const userAnswerBool = userAnswer === 'true' || userAnswer === true
        const correctAnswerBool = question.correctAnswer
        isCorrect = userAnswerBool === correctAnswerBool

        resultData.correctAnswer = correctAnswerBool
        resultData.userAnswer = userAnswerBool
      } else if (question.questionType === 'matching') {
        // Parse matching pairs and user matches
        const matchingPairs = question.matchingPairs ? JSON.parse(question.matchingPairs) : []
        const correctMatches = question.correctMatches ? JSON.parse(question.correctMatches) : []
        
        // Extract user matches from answers (format: questionId_leftIndex -> rightIndex)
        const userMatches: number[] = []
        matchingPairs.forEach((_: any, idx: number) => {
          const matchKey = `${question.id}_${idx}`
          if (answers[matchKey]) {
            userMatches[idx] = parseInt(answers[matchKey])
          }
        })
        
        // Check if all matches are correct
        isCorrect = correctMatches.length > 0 && correctMatches.every((cm: any) => {
          return userMatches[cm.leftIndex] === cm.rightIndex
        }) && userMatches.length === correctMatches.length

        resultData.leftColumn = matchingPairs.map((p: any) => p.left)
        resultData.rightColumn = matchingPairs.map((p: any) => p.right).filter((r: string) => r)
        resultData.correctMatches = correctMatches
        resultData.userMatches = userMatches
      } else if (question.questionType === 'composite') {
        // Composite questions have both MCQ and fill-in parts
        const options = question.options ? JSON.parse(question.options) : []
        const compositeAnswer = userAnswer ? JSON.parse(userAnswer) : { mcq: null, fill: '' }
        
        // Check MCQ part
        const mcqCorrect = compositeAnswer.mcq !== null && 
          parseInt(compositeAnswer.mcq) === question.correctOptionIndex
        
        // Check fill-in part
        const fillCorrect = compositeAnswer.fill && question.correctText &&
          compositeAnswer.fill.trim().toLowerCase() === question.correctText.trim().toLowerCase()
        
        // Both parts must be correct
        isCorrect = mcqCorrect && fillCorrect

        resultData.options = options
        resultData.correctOptionIndex = question.correctOptionIndex
        resultData.userMcqAnswer = compositeAnswer.mcq !== null ? parseInt(compositeAnswer.mcq) : null
        resultData.fillInPrompt = question.fillInPrompt
        resultData.fillInCorrectText = question.correctText
        resultData.userFillAnswer = compositeAnswer.fill || ''
        resultData.isFillCorrect = fillCorrect
      } else if (question.questionType === 'sequencing') {
        // For sequencing questions, user answer is a JSON object mapping item indices to positions
        const items = question.options ? JSON.parse(question.options) : []
        const correctOrder = question.correctOrder ? JSON.parse(question.correctOrder) : []
        const userOrderMap = userAnswer ? JSON.parse(userAnswer) : {}
        
        // Convert user's position map to ordered array of item indices
        // userOrderMap: { 0: 2, 1: 1, 2: 3 } means item 0 is at position 2, item 1 at position 1, etc.
        // We need to convert this to [1, 0, 2] (item indices in order)
        const userOrder: number[] = []
        const positionToItem: { [key: number]: number } = {}
        
        // Build map of position -> item index
        Object.keys(userOrderMap).forEach((itemIndexStr) => {
          const itemIndex = parseInt(itemIndexStr)
          const position = userOrderMap[itemIndex]
          if (position !== '' && position !== null && position !== undefined) {
            positionToItem[position] = itemIndex
          }
        })
        
        // Build ordered array from positions 1 to N
        for (let pos = 1; pos <= items.length; pos++) {
          if (positionToItem[pos] !== undefined) {
            userOrder.push(positionToItem[pos])
          }
        }
        
        // Compare user order with correct order
        isCorrect = correctOrder.length > 0 && 
          userOrder.length === correctOrder.length &&
          userOrder.every((itemIndex, pos) => itemIndex === correctOrder[pos])

        resultData.items = items
        resultData.correctOrder = correctOrder
        resultData.userOrder = userOrder
      }

      resultData.isCorrect = isCorrect
      return resultData
    })

    // Calculate score excluding descriptive questions (they require manual grading)
    const gradableQuestions = results.filter((r) => 
      r.questionType !== 'descriptive'
    )
    const descriptiveQuestions = results.filter((r) => r.questionType === 'descriptive')
    
    const correctCount = gradableQuestions.filter((r) => r.isCorrect).length
    const totalCount = gradableQuestions.length
    const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0

    return res.status(200).json({
      results,
      score: Math.round(score * 100) / 100,
      correctCount,
      totalCount,
      descriptiveCount: descriptiveQuestions.length,
    })
  } catch (error) {
    console.error('Error submitting test:', error)
    return res.status(500).json({
      error: 'Failed to submit test',
    })
  }
}

