import type { NextApiResponse } from 'next'
import { requireTeacher, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'
import { generateShareLink } from '@/lib/utils'
import { extractTextFromFile } from '@/lib/fileParser'
import { parseQuestionsFromText } from '@/lib/llmParser'
import { validateQuestions } from '@/lib/utils'
import formidable, { File as FormidableFile } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function parseFormData(req: AuthenticatedRequest): Promise<{ file: File; formidableFile: FormidableFile }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    })

    form.parse(req, async (err, fields, files) => {
      if (err) {
        reject(err)
        return
      }

      const fileArray = Array.isArray(files.file) ? files.file : files.file ? [files.file] : []
      const file = fileArray[0] as FormidableFile | undefined

      if (!file) {
        reject(new Error('No file uploaded'))
        return
      }

      try {
        // Read file buffer
        const fileBuffer = fs.readFileSync(file.filepath)
        const fileBlob = new Blob([fileBuffer])
        const fileObj = new File([fileBlob], file.originalFilename || 'file', {
          type: file.mimetype || 'application/octet-stream',
        })

        // Don't delete temp file yet - we'll save it to uploads folder
        resolve({ file: fileObj, formidableFile: file })
      } catch (error) {
        // Clean up temp file on error
        if (file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath)
        }
        reject(error)
      }
    })
  })
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get teacher profile
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: req.user.id }
    })
    
    if (!teacherProfile) {
      return res.status(404).json({ error: 'Teacher profile not found' })
    }

    // Parse the multipart form data
    const { file, formidableFile } = await parseFormData(req)
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Extract text from file to get questions and answers
    const { text, error: parseError } = await extractTextFromFile(
      file,
      file.type
    )

    if (parseError || !text.trim()) {
      return res.status(400).json({
        error: parseError || 'Could not extract text from file',
      })
    }

    // Parse questions and correct answers from the PDF using AI
    let questions
    try {
      console.log(`Starting question extraction from text (${text.length} characters)`)
      questions = await parseQuestionsFromText(text)
      console.log(`Successfully extracted ${questions.length} questions`)
    } catch (error) {
      console.error('LLM parsing error:', error)
      console.error('Error details:', error instanceof Error ? error.stack : error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred'
      return res.status(400).json({
        error: `Failed to extract questions: ${errorMessage}`,
      })
    }

    // Validate questions
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        error: 'No questions found in the document. Please ensure your document contains questions with clear answers.',
      })
    }

    const validation = validateQuestions(questions)
    if (!validation.valid) {
      console.error('Validation failed for questions:', JSON.stringify(questions, null, 2))
      console.error('Validation errors:', validation.errors)
      
      const errorMessage = validation.errors.length > 0
        ? `Invalid question format: ${validation.errors.slice(0, 3).join('; ')}${validation.errors.length > 3 ? ` (and ${validation.errors.length - 3} more)` : ''}`
        : 'Some questions have invalid format. Please check that each question has proper options and correct answers.'
      
      return res.status(400).json({
        error: errorMessage,
      })
    }

    // Generate unique share link
    let shareLink = generateShareLink()
    let linkExists = true
    let attempts = 0

    // Ensure unique link (retry if collision)
    while (linkExists && attempts < 10) {
      const existing = await prisma.test.findUnique({
        where: { shareLink },
      })
      if (!existing) {
        linkExists = false
      } else {
        shareLink = generateShareLink()
        attempts++
      }
    }

    if (linkExists) {
      return res.status(500).json({
        error: 'Failed to generate unique share link',
      })
    }

    // Save the uploaded file to disk
    const fileExtension = path.extname(formidableFile.originalFilename || file.name)
    const fileName = `${shareLink}${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)
    
    // Copy file from temp location to uploads folder
    fs.copyFileSync(formidableFile.filepath, filePath)
    
    // Clean up temp file
    if (fs.existsSync(formidableFile.filepath)) {
      fs.unlinkSync(formidableFile.filepath)
    }

    // Filter out invalid questions (empty or just numbers)
    questions = questions.filter((q) => {
      const text = q.questionText?.trim() || ''
      // Filter out questions that are just numbers or whitespace
      if (!text || text.length < 10) {
        console.warn(`Filtering out invalid question: "${text.substring(0, 50)}..."`)
        return false
      }
      // Filter out questions that are just a list of numbers
      if (/^[\d\.\s\n]+$/.test(text)) {
        console.warn(`Filtering out question that's just numbers: "${text.substring(0, 50)}..."`)
        return false
      }
      return true
    })

    // Extract and link images to questions if it's a PDF
    if (fileExtension === '.pdf' && questions.length > 0) {
      const { getPdfPagesWithContent, extractImagesFromPdf, linkImagesToQuestions } = await import('@/lib/imageExtractor')
      const pdfPages = await getPdfPagesWithContent(filePath)
      
      // Extract images from PDF pages
      const imagesDir = path.join(process.cwd(), 'uploads', 'images', shareLink)
      const imageMap = await extractImagesFromPdf(filePath, shareLink, imagesDir)
      
      // Link extracted images to questions
      questions = linkImagesToQuestions(questions, pdfPages, shareLink, imageMap)
      console.log(`Linked ${imageMap.size} extracted images to ${questions.length} questions from ${pdfPages.length} PDF pages`)
    }

    // Save to database with questions and correct answers
    const test = await prisma.test.create({
      data: {
        shareLink,
        title: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: formidableFile.originalFilename || file.name,
        filePath: fileName, // Store relative path
        teacherId: teacherProfile.id, // Link to teacher
        status: 'PUBLISHED', // Auto-publish for now
        visibility: 'PUBLIC', // Keep existing behavior
        questions: {
          create: questions.map((q, index) => {
            const baseData: any = {
              questionText: q.questionText,
              questionType: q.questionType,
              order: index,
            }

            // Preserve original structure
            if ('originalNumber' in q && q.originalNumber) {
              baseData.originalNumber = q.originalNumber
            }
            if ('section' in q && q.section) {
              baseData.section = q.section
            }

            // Handle different question types
            if (q.questionType === 'multiple_choice') {
              baseData.options = JSON.stringify(q.options)
              baseData.correctOptionIndex = q.correctOptionIndex ?? null
            } else if (q.questionType === 'multiple_answer') {
              baseData.options = JSON.stringify(q.options)
              baseData.correctAnswers = q.correctAnswers ? JSON.stringify(q.correctAnswers) : null
            } else if (q.questionType === 'fill_blank') {
              baseData.correctText = q.correctText || null
            } else if (q.questionType === 'descriptive') {
              // For descriptive questions, store sample answer if provided
              if ('sampleAnswer' in q && q.sampleAnswer) {
                baseData.correctText = q.sampleAnswer // Reuse correctText field for sample answer
              }
            } else if (q.questionType === 'true_false') {
              // For true/false questions, store the correct answer
              baseData.correctAnswer = 'correctAnswer' in q ? q.correctAnswer : null
            } else if (q.questionType === 'matching' && 'leftColumn' in q && 'rightColumn' in q) {
              // For matching questions, store left and right columns
              const matchingPairs = q.leftColumn.map((left: string, idx: number) => ({
                left,
                right: q.rightColumn[idx] || '',
              }))
              baseData.matchingPairs = JSON.stringify(matchingPairs)
              // Store correct matches if provided
              if (q.correctMatches && Array.isArray(q.correctMatches)) {
                baseData.correctMatches = JSON.stringify(q.correctMatches)
              }
            } else if (q.questionType === 'composite') {
              // Composite questions have both MCQ and fill-in parts
              baseData.options = JSON.stringify(q.options)
              baseData.correctOptionIndex = q.correctOptionIndex ?? null
              baseData.hasFillInPart = true
              baseData.fillInPrompt = q.fillInPrompt || null
              baseData.correctText = q.fillInCorrectText || null
            } else if (q.questionType === 'sequencing') {
              // For sequencing questions, store items in options field and correct order
              baseData.options = JSON.stringify(q.items || [])
              if (q.correctOrder && Array.isArray(q.correctOrder)) {
                baseData.correctOrder = JSON.stringify(q.correctOrder)
              }
            }
            
            // Handle imageUrl if present
            if (q.imageUrl) {
              baseData.imageUrl = q.imageUrl
            }

            return baseData
          }),
        },
      },
      include: {
        questions: true,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const fileUrl = `${baseUrl}/api/file/${shareLink}`
    const shareableUrl = `${baseUrl}/file/${shareLink}` // Link to view/download file

    return res.status(200).json({
      success: true,
      testId: test.id,
      shareLink,
      shareableUrl, // Link to view the original file and take test
      fileUrl, // Direct download link
      originalFileName: test.originalFileName,
      questionCount: questions.length,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Failed to process file',
    })
  }
}

export default requireTeacher(handler)
