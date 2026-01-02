import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Question {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'multiple_answer' | 'fill_blank' | 'descriptive' | 'matching' | 'composite'
  options?: string[]
  correctOptionIndex?: number
  correctAnswers?: number[]
  correctText?: string
  sampleAnswer?: string
  leftColumn?: string[]
  rightColumn?: string[]
  correctMatches?: Array<{ leftIndex: number; rightIndex: number }>
  hasFillInPart?: boolean
  fillInPrompt?: string
  fillInCorrectText?: string
  order: number
  originalNumber?: string
  section?: string
  imageUrl?: string
}

interface Test {
  id: string
  title: string | null
  shareLink: string
  questions: Question[]
}

interface Results {
  results: Array<{
    questionId: string
    questionText: string
    questionType: 'multiple_choice' | 'multiple_answer' | 'fill_blank' | 'descriptive' | 'matching' | 'composite'
    options?: string[]
    correctOptionIndex?: number
    correctAnswers?: number[]
    correctText?: string
    sampleAnswer?: string
    leftColumn?: string[]
    rightColumn?: string[]
    correctMatches?: Array<{ leftIndex: number; rightIndex: number }>
    userMatches?: number[]
    userMcqAnswer?: number
    userFillAnswer?: string
    isFillCorrect?: boolean
    fillInPrompt?: string
    fillInCorrectText?: string
    userAnswer?: number | null | string
    userAnswers?: number[]
    isCorrect: boolean
  }>
  score: number
  correctCount: number
  totalCount: number
  descriptiveCount?: number
}

export default function TestPage() {
  const router = useRouter()
  const { shareLink } = router.query
  const [test, setTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<Results | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (shareLink && typeof shareLink === 'string') {
      fetchTest(shareLink)
    }
  }, [shareLink])

  const fetchTest = async (link: string) => {
    try {
      const response = await fetch(`/api/test/${link}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load test')
      }

      setTest(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: string | number) => {
    if (submitted) return
    setAnswers((prev) => {
      const newAnswers = { ...prev }
      newAnswers[questionId] = typeof value === 'number' ? value.toString() : value
      
      // For composite questions, update the combined answer
      if (questionId.includes('_mcq') || questionId.includes('_fill')) {
        const baseId = questionId.replace(/_mcq$/, '').replace(/_fill$/, '')
        const mcqAnswer = newAnswers[`${baseId}_mcq`] || null
        const fillAnswer = newAnswers[`${baseId}_fill`] || ''
        newAnswers[baseId] = JSON.stringify({ mcq: mcqAnswer, fill: fillAnswer })
      }
      
      return newAnswers
    })
  }

  const handleMultipleAnswerChange = (questionId: string, optionIndex: number) => {
    if (submitted) return
    setAnswers((prev) => {
      const current = prev[questionId]
      const currentArray = current ? JSON.parse(current) : []
      const index = currentArray.indexOf(optionIndex)
      
      if (index > -1) {
        // Remove if already selected
        currentArray.splice(index, 1)
      } else {
        // Add if not selected
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
    if (!test || submitted) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/submit/${test.shareLink}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit test')
      }

      setResults(data)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit test')
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

  if (error || !test) {
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
        <title>{test.title || 'Test'}</title>
      </Head>
      <main className="container">
        <div className="test-header">
          <h1>{test.title || 'Test'}</h1>
          {!submitted && (
            <p className="question-count">
              {test.questions.length} question{test.questions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {submitted && results ? (
          <div className="results-section">
            <div className="score-display">
              <h2>Your Score</h2>
              <div className="score-circle">
                <span className="score-value">{results.score}%</span>
                <span className="score-detail">
                  {results.correctCount} / {results.totalCount} correct
                </span>
                {results.descriptiveCount && results.descriptiveCount > 0 && (
                  <span className="score-note">
                    ({results.descriptiveCount} descriptive question{results.descriptiveCount !== 1 ? 's' : ''} require manual grading)
                  </span>
                )}
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
                  <p className="question-text">{result.questionText}</p>
                  
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
                          <span className={`answer-text ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                            {result.userAnswer || '(No answer provided)'}
                          </span>
                        </div>
                        <div className="answer-row">
                          <span className="answer-label">Correct Answer:</span>
                          <span className="answer-text correct">{result.correctText}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.questionType === 'descriptive' && (
                    <div className="descriptive-results">
                      <div className="answer-comparison">
                        <div className="answer-row">
                          <span className="answer-label">Your Answer:</span>
                          <div className={`answer-text descriptive ${result.userAnswer ? '' : 'no-answer'}`}>
                            {result.userAnswer ? (
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {result.userAnswer}
                              </pre>
                            ) : (
                              '(No answer provided)'
                            )}
                          </div>
                        </div>
                        {result.sampleAnswer && (
                          <div className="answer-row">
                            <span className="answer-label">Sample Answer:</span>
                            <div className="answer-text correct descriptive">
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {result.sampleAnswer}
                              </pre>
                            </div>
                          </div>
                        )}
                        <p className="descriptive-note">
                          Note: Descriptive questions are not automatically graded. Please review your answer against the sample answer (if provided).
                        </p>
                      </div>
                    </div>
                  )}

                  {result.questionType === 'matching' && result.leftColumn && result.rightColumn && (
                    <div className="matching-results">
                      <div className="matching-container">
                        <div className="matching-column">
                          <h4 className="matching-column-title">Matching Results</h4>
                          {result.leftColumn.map((leftItem: string, idx: number) => {
                            const userMatch = result.userMatches?.[idx]
                            const correctMatch = result.correctMatches?.find((m: any) => m.leftIndex === idx)
                            const isCorrect = userMatch === correctMatch?.rightIndex
                            
                            return (
                              <div key={idx} className={`matching-row-result ${isCorrect ? 'correct' : 'incorrect'}`}>
                                <span className="matching-left-item">{leftItem}</span>
                                <span className="matching-arrow">→</span>
                                <span className="matching-right-item">
                                  {userMatch !== undefined && userMatch !== null
                                    ? result.rightColumn[userMatch]
                                    : '(Not matched)'}
                                </span>
                                {correctMatch && (
                                  <span className="matching-correct">
                                    (Correct: {result.rightColumn[correctMatch.rightIndex]})
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {result.questionType === 'composite' && (
                    <div className="composite-results">
                      <div className="composite-mcq-results">
                        <h4>Multiple Choice Part:</h4>
                        {result.options && (
                          <div className="options-results">
                            {result.options.map((option: string, optIndex: number) => {
                              const isCorrect = optIndex === result.correctOptionIndex
                              const isUserAnswer = optIndex === result.userMcqAnswer
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
                      </div>
                      {result.fillInPrompt && (
                        <div className="composite-fill-results">
                          <h4>Fill-in-the-Blank Part:</h4>
                          <div className="answer-comparison">
                            <div className="answer-row">
                              <span className="answer-label">Your Answer:</span>
                              <span className={`answer-text ${result.isFillCorrect ? 'correct' : 'incorrect'}`}>
                                {result.userFillAnswer || '(No answer provided)'}
                              </span>
                            </div>
                            {result.fillInCorrectText && (
                              <div className="answer-row">
                                <span className="answer-label">Correct Answer:</span>
                                <span className="answer-text correct">{result.fillInCorrectText}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="test-form">
            {test.questions.map((question, index) => {
              // Group questions by section if sections exist
              const currentSection = question.section
              const prevQuestion = index > 0 ? test.questions[index - 1] : null
              const showSectionHeader = currentSection && currentSection !== prevQuestion?.section

              return (
                <div key={question.id}>
                  {showSectionHeader && (
                    <div className="section-header">
                      <h2 className="section-title">{currentSection}</h2>
                    </div>
                  )}
                  <div className="question-card">
                    <div className="question-header">
                      <span className="question-number">
                        {question.originalNumber || `Question ${index + 1}`}
                      </span>
                      <span className="question-type-badge">
                        {question.questionType === 'multiple_choice' && 'Single Choice'}
                        {question.questionType === 'multiple_answer' && 'Multiple Answers'}
                        {question.questionType === 'fill_blank' && 'Fill in the Blank'}
                        {question.questionType === 'descriptive' && 'Descriptive'}
                        {question.questionType === 'matching' && 'Matching'}
                        {question.questionType === 'composite' && 'Composite'}
                      </span>
                    </div>
                    {question.imageUrl && (
                      <div className="question-image">
                        <img src={question.imageUrl} alt="Question illustration" />
                      </div>
                    )}
                    <p className="question-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {question.questionText}
                    </p>
                
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

                {question.questionType === 'descriptive' && (
                  <div className="descriptive-input">
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="Type your detailed answer here..."
                      className="descriptive-textarea"
                      rows={8}
                    />
                    <p className="descriptive-hint">
                      Please provide a detailed answer to this question.
                    </p>
                  </div>
                )}

                {question.questionType === 'matching' && question.leftColumn && question.rightColumn && (
                  <div className="matching-input">
                    <div className="matching-container">
                      <div className="matching-column">
                        <h4 className="matching-column-title">Items</h4>
                        {question.leftColumn.map((leftItem, idx) => (
                          <div key={idx} className="matching-row">
                            <span className="matching-left-item">{leftItem}</span>
                            <select
                              value={answers[`${question.id}_${idx}`] || ''}
                              onChange={(e) => {
                                const matchAnswers = { ...answers }
                                matchAnswers[`${question.id}_${idx}`] = e.target.value
                                // Store as JSON for this question
                                const questionMatches: Record<number, number> = {}
                                question.leftColumn?.forEach((_, i) => {
                                  const matchKey = `${question.id}_${i}`
                                  if (matchAnswers[matchKey]) {
                                    questionMatches[i] = parseInt(matchAnswers[matchKey])
                                  }
                                })
                                matchAnswers[question.id] = JSON.stringify(questionMatches)
                                setAnswers(matchAnswers)
                              }}
                              className="matching-select"
                            >
                              <option value="">-- Select --</option>
                              {question.rightColumn.map((rightItem, rightIdx) => (
                                <option key={rightIdx} value={rightIdx}>
                                  {rightItem}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {question.questionType === 'composite' && (
                  <div className="composite-input">
                    {/* Multiple choice part */}
                    {question.options && (
                      <div className="composite-mcq-part">
                        <p className="composite-part-label">Select one option:</p>
                        <div className="options-group">
                          {question.options.map((option, optIndex) => {
                            const isSelected = answers[`${question.id}_mcq`] === optIndex.toString()
                            return (
                              <label
                                key={optIndex}
                                className={`option-label ${isSelected ? 'selected' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`${question.id}_mcq`}
                                  value={optIndex}
                                  checked={isSelected}
                                  onChange={() => handleAnswerChange(`${question.id}_mcq`, optIndex)}
                                  className="radio-input"
                                />
                                <span className="option-letter">
                                  {String.fromCharCode(65 + optIndex)}.
                                </span>
                                <span className="option-text">{option}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* Fill-in-the-blank part */}
                    {question.hasFillInPart && question.fillInPrompt && (
                      <div className="composite-fill-part">
                        <p className="composite-part-label">{question.fillInPrompt}</p>
                        <input
                          type="text"
                          value={answers[`${question.id}_fill`] || ''}
                          onChange={(e) => handleAnswerChange(`${question.id}_fill`, e.target.value)}
                          placeholder="Type your answer here..."
                          className="text-input"
                        />
                      </div>
                    )}
                  </div>
                )}
                  </div>
                </div>
              )
            })}

            <div className="submit-section">
              <div className="answer-progress">
                <div className="progress-info">
                  <span className="progress-text">
                    Answered: {Object.keys(answers).length} / {test.questions.length}
                  </span>
                  <div className="progress-bar-mini">
                    <div
                      className="progress-fill-mini"
                      style={{
                        width: `${(Object.keys(answers).length / test.questions.length) * 100}%`,
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
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    <span>Submit Test</span>
                  </>
                )}
              </button>
              {Object.keys(answers).length < test.questions.length && (
                <p className="warning-text">
                  You have answered {Object.keys(answers).length} of{' '}
                  {test.questions.length} questions
                </p>
              )}
            </div>
          </form>
        )}

        <div className="test-footer">
          <Link href="/" className="back-link">
            ← Create Your Own Test
          </Link>
        </div>
      </main>
    </>
  )
}

