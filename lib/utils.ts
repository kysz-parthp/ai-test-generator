import { v4 as uuidv4 } from 'uuid'

export function generateShareLink(): string {
  // Generate a short, URL-friendly identifier
  return uuidv4().replace(/-/g, '').substring(0, 16)
}

export function validateQuestions(questions: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, errors: ['No questions found in the response'] }
  }

  questions.forEach((q, index) => {
    // Basic validation for all question types
    if (!q.questionType) {
      errors.push(`Question ${index + 1}: Missing questionType`)
      return
    }
    
    if (typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
      errors.push(`Question ${index + 1}: Missing or empty questionText`)
      return
    }

    // Validate based on question type
    if (q.questionType === 'multiple_choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Question ${index + 1}: Multiple choice must have at least 2 options`)
      }
      // Allow optional correctOptionIndex - answers may not be marked in the document
      if (q.correctOptionIndex !== undefined && q.correctOptionIndex !== null) {
        if (typeof q.correctOptionIndex !== 'number' || q.correctOptionIndex < 0) {
          errors.push(`Question ${index + 1}: Invalid correctOptionIndex`)
        }
        if (q.options && q.correctOptionIndex >= q.options.length) {
          errors.push(`Question ${index + 1}: correctOptionIndex (${q.correctOptionIndex}) is out of range (0-${q.options.length - 1})`)
        }
      }
      // Note: correctOptionIndex is optional - questions can be extracted without answers
    } else if (q.questionType === 'multiple_answer') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Question ${index + 1}: Multiple answer must have at least 2 options`)
      }
      // Allow optional correctAnswers - answers may not be marked in the document
      if (q.correctAnswers !== undefined && q.correctAnswers !== null) {
        if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
          errors.push(`Question ${index + 1}: Invalid correctAnswers array`)
        }
        if (q.options && q.correctAnswers) {
          const invalidIndices = q.correctAnswers.filter((idx: number) => idx < 0 || idx >= q.options.length)
          if (invalidIndices.length > 0) {
            errors.push(`Question ${index + 1}: Invalid correctAnswers indices: ${invalidIndices.join(', ')}`)
          }
        }
      }
      // Note: correctAnswers is optional - questions can be extracted without answers
    } else if (q.questionType === 'fill_blank') {
      // correctText is optional - questions can be extracted without answers
      if (q.correctText !== undefined && q.correctText !== null && typeof q.correctText !== 'string') {
        errors.push(`Question ${index + 1}: Invalid correctText type`)
      }
      // Note: correctText can be empty or missing - that's OK
    } else if (q.questionType === 'descriptive') {
      // Descriptive questions don't require options or correct answers
      // sampleAnswer is optional
      if (q.sampleAnswer !== undefined && q.sampleAnswer !== null && typeof q.sampleAnswer !== 'string') {
        errors.push(`Question ${index + 1}: Invalid sampleAnswer type`)
      }
    } else if (q.questionType === 'matching') {
      // Matching questions require left and right columns
      if (!Array.isArray(q.leftColumn) || q.leftColumn.length < 2) {
        errors.push(`Question ${index + 1}: Matching question must have at least 2 left column items`)
      }
      if (!Array.isArray(q.rightColumn) || q.rightColumn.length < 2) {
        errors.push(`Question ${index + 1}: Matching question must have at least 2 right column items`)
      }
      // Validate correctMatches if provided
      if (q.correctMatches !== undefined && q.correctMatches !== null) {
        if (!Array.isArray(q.correctMatches)) {
          errors.push(`Question ${index + 1}: Invalid correctMatches format`)
        }
      }
    } else if (q.questionType === 'composite') {
      // Composite questions need both MCQ options and fill-in prompt
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Question ${index + 1}: Composite question must have at least 2 options`)
      }
      if (!q.fillInPrompt || typeof q.fillInPrompt !== 'string' || q.fillInPrompt.trim().length === 0) {
        errors.push(`Question ${index + 1}: Composite question must have a fillInPrompt`)
      }
      // correctOptionIndex and fillInCorrectText are optional
    } else {
      errors.push(`Question ${index + 1}: Unknown questionType "${q.questionType}"`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

