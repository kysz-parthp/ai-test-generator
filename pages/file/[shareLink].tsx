import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Question {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'multiple_answer' | 'fill_blank'
  options?: string[]
  correctOptionIndex?: number
  correctAnswers?: number[]
  correctText?: string
  imageUrl?: string | null
  order: number
}

interface Results {
  results: Array<{
    questionId: string
    questionText: string
    questionType: 'multiple_choice' | 'multiple_answer' | 'fill_blank'
    options?: string[]
    correctOptionIndex?: number
    correctAnswers?: number[]
    correctText?: string
    userAnswer?: number | null | string
    userAnswers?: number[]
    isCorrect: boolean
  }>
  score: number
  correctCount: number
  totalCount: number
}

export default function FileViewPage() {
  const router = useRouter()
  const { shareLink } = router.query
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{
    originalFileName: string
    fileUrl: string
  } | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<Results | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (shareLink && typeof shareLink === 'string') {
      fetchTestData(shareLink)
    }
  }, [shareLink])

  const fetchTestData = async (link: string) => {
    try {
      const response = await fetch(`/api/test/${link}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load test')
      }

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions)
      }

      const fileName = data.originalFileName || data.title || 'Question Paper'
      
      if (!fileName) {
        throw new Error('File information not found')
      }

      setFileInfo({
        originalFileName: fileName,
        fileUrl: `/api/file/${link}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: string | number) => {
    if (submitted) return
    setAnswers((prev) => ({
      ...prev,
      [questionId]: typeof value === 'number' ? value.toString() : value,
    }))
  }

  const handleMultipleAnswerChange = (questionId: string, optionIndex: number) => {
    if (submitted) return
    setAnswers((prev) => {
      const current = prev[questionId]
      const currentArray = current ? JSON.parse(current) : []
      const index = currentArray.indexOf(optionIndex)
      
      if (index > -1) {
        currentArray.splice(index, 1)
      } else {
        currentArray.push(optionIndex)
      }
      
      return {
        ...prev,
        [questionId]: JSON.stringify(currentArray.sort()),
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareLink || typeof shareLink !== 'string' || submitted) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/evaluate/${shareLink}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to evaluate test')
      }

      setResults(data)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate test')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Test...</title>
        </Head>
        <main className="container">
          <div className="loading">
            <LoadingSpinner size="large" />
            <p>Loading test...</p>
          </div>
        </main>
      </>
    )
  }

  if (error || !fileInfo) {
    return (
      <>
        <Head>
          <title>Error</title>
        </Head>
        <main className="container">
          <div className="error-message">
            {error || 'Test not found'}
          </div>
          <Link href="/" className="back-link">
            ← Back to Home
          </Link>
        </main>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{fileInfo.originalFileName}</title>
      </Head>
      <main className="container">
        <div className="file-view-header">
          <h1>📝 {fileInfo.originalFileName}</h1>
          <p className="file-subtitle">Answer the questions below</p>
        </div>

        {questions.length > 0 && !submitted && (
          <div className="answer-section">
            <h2>Answer the Questions</h2>
            <p className="questions-info">
              {questions.length} question{questions.length !== 1 ? 's' : ''} extracted from the document.
            </p>
            <form onSubmit={handleSubmit} className="test-form">
              {questions.map((question, index) => (
                <div key={question.id} className="question-card">
                  <div className="question-header">
                    <span className="question-number">Question {index + 1}</span>
                    <span className="question-type-badge">
                      {question.questionType === 'multiple_choice' ? 'Single Choice' :
                       question.questionType === 'multiple_answer' ? 'Multiple Answers' :
                       'Fill in the Blank'}
                    </span>
                  </div>
                  
                  <div className="question-prompt">
                    <p className="question-text">{question.questionText}</p>
                  </div>
                  
                  {question.questionType === 'multiple_choice' && question.options && (
                    <div className="options-group">
                      {question.options.map((option, optIndex) => {
                        const isSelected = answers[question.id] === optIndex.toString()
                        return (
                          <label
                            key={optIndex}
                            className={`option-label ${isSelected ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={optIndex}
                              checked={isSelected}
                              onChange={() => handleAnswerChange(question.id, optIndex)}
                              className="radio-input"
                            />
                            <span className="option-letter">
                              {optIndex + 1}.
                            </span>
                            <span className="option-text">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {question.questionType === 'multiple_answer' && question.options && (
                    <div className="options-group">
                      <p className="multiple-answer-hint">Select all that apply:</p>
                      {question.options.map((option, optIndex) => {
                        const currentAnswers = answers[question.id] 
                          ? JSON.parse(answers[question.id]) 
                          : []
                        const isSelected = currentAnswers.includes(optIndex)
                        return (
                          <label
                            key={optIndex}
                            className={`option-label ${isSelected ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              name={question.id}
                              value={optIndex}
                              checked={isSelected}
                              onChange={() => handleMultipleAnswerChange(question.id, optIndex)}
                              className="checkbox-input"
                            />
                            <span className="option-letter">
                              {optIndex + 1}.
                            </span>
                            <span className="option-text">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {question.questionType === 'fill_blank' && (
                    <div className="fill-blank-input">
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Type your answer here..."
                        className="text-input"
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="submit-section">
                <div className="answer-progress">
                  <div className="progress-info">
                    <span className="progress-text">
                      Answered: {Object.keys(answers).length} / {questions.length}
                    </span>
                    <div className="progress-bar-mini">
                      <div
                        className="progress-fill-mini"
                        style={{
                          width: `${(Object.keys(answers).length / questions.length) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting || Object.keys(answers).length === 0}
                  className="submit-test-button"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Submit Answers</span>
                    </>
                  )}
                </button>
                {Object.keys(answers).length < questions.length && (
                  <p className="warning-text">
                    You have answered {Object.keys(answers).length} of {questions.length} questions
                  </p>
                )}
              </div>
            </form>
          </div>
        )}

        {submitted && results && (
          <div className="results-section">
            <div className="score-display">
              <h2>Your Score</h2>
              <div className="score-circle">
                <span className="score-value">{results.score}%</span>
                <span className="score-detail">
                  {results.correctCount} / {results.totalCount} correct
                </span>
              </div>
            </div>

            <div className="questions-results">
              {results.results.map((result, index) => (
                <div
                  key={result.questionId}
                  className={`question-result ${
                    result.isCorrect ? 'correct' : 'incorrect'
                  }`}
                >
                  <div className="question-header">
                    <span className="question-number">Question {index + 1}</span>
                    <span
                      className={`status-badge ${
                        result.isCorrect ? 'correct-badge' : 'incorrect-badge'
                      }`}
                    >
                      {result.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                  <div className="question-prompt">
                    <p className="question-text">{result.questionText}</p>
                  </div>
                  
                  {result.questionType === 'multiple_choice' && result.options && (
                    <div className="options-results">
                      {result.options.map((option, optIndex) => {
                        const isCorrect = optIndex === result.correctOptionIndex
                        const isUserAnswer = optIndex === result.userAnswer
                        let className = 'option-result'

                        if (isCorrect) {
                          className += ' correct-option'
                        } else if (isUserAnswer && !isCorrect) {
                          className += ' wrong-option'
                        }

                        return (
                          <div key={optIndex} className={className}>
                            <span className="option-label">
                              {String.fromCharCode(65 + optIndex)}.
                            </span>
                            <span className="option-text">{option}</span>
                            {isCorrect && (
                              <span className="correct-indicator">✓ Correct Answer</span>
                            )}
                            {isUserAnswer && !isCorrect && (
                              <span className="wrong-indicator">✗ Your Answer</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {result.questionType === 'multiple_answer' && result.options && (
                    <div className="options-results">
                      {result.options.map((option, optIndex) => {
                        const isCorrect = result.correctAnswers?.includes(optIndex)
                        const isUserAnswer = result.userAnswers?.includes(optIndex)
                        let className = 'option-result'

                        if (isCorrect && isUserAnswer) {
                          className += ' correct-option'
                        } else if (isCorrect && !isUserAnswer) {
                          className += ' correct-option missed'
                        } else if (!isCorrect && isUserAnswer) {
                          className += ' wrong-option'
                        }

                        return (
                          <div key={optIndex} className={className}>
                            <span className="option-label">
                              {String.fromCharCode(65 + optIndex)}.
                            </span>
                            <span className="option-text">{option}</span>
                            {isCorrect && (
                              <span className="correct-indicator">✓ Correct Answer</span>
                            )}
                            {isUserAnswer && !isCorrect && (
                              <span className="wrong-indicator">✗ Your Answer (Incorrect)</span>
                            )}
                            {isCorrect && !isUserAnswer && (
                              <span className="missed-indicator">○ Missed (Correct)</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {result.questionType === 'fill_blank' && (
                    <div className="fill-blank-results">
                      <div className="answer-comparison">
                        <div className="answer-row">
                          <span className="answer-label">Your Answer:</span>
                          <div className={`answer-text ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                            {result.userAnswer || '(No answer provided)'}
                          </div>
                        </div>
                        {result.correctText && (
                          <div className="answer-row">
                            <span className="answer-label">Correct Answer:</span>
                            <div className="answer-text correct">
                              {result.correctText}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {questions.length === 0 && !submitted && (
          <div className="file-footer">
            <p className="footer-note">
              If questions were not automatically extracted, please contact your teacher.
            </p>
          </div>
        )}

        <div className="file-footer">
          <Link href="/" className="back-link">
            ← Upload Your Own File
          </Link>
        </div>
      </main>
    </>
  )
}
