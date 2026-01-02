import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { Readable } from 'stream'

export interface ParsedText {
  text: string
  error?: string
}

export async function extractTextFromFile(
  file: File,
  mimeType: string
): Promise<ParsedText> {
  try {
    if (mimeType === 'text/plain' || file.name.endsWith('.txt')) {
      return await extractTextFromTxt(file)
    } else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')
    ) {
      return await extractTextFromDocx(file)
    } else if (mimeType === 'application/pdf' || file.name.endsWith('.pdf')) {
      return await extractTextFromPdf(file)
    } else {
      return {
        text: '',
        error: `Unsupported file type: ${mimeType}`,
      }
    }
  } catch (error) {
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function extractTextFromTxt(file: File): Promise<ParsedText> {
  const text = await file.text()
  return { text }
}

async function extractTextFromDocx(file: File): Promise<ParsedText> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return { text: result.value }
}

async function extractTextFromPdf(file: File): Promise<ParsedText> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const data = await pdfParse(buffer, {
      // Preserve text layout better
      max: 0, // No page limit - extract ALL pages
    })
    
    // Clean up the extracted text
    let text = data.text
    
    // Log extraction info
    console.log(`PDF extracted: ${data.numpages} pages, ${text.length} characters`)
    
    // Remove excessive whitespace but preserve structure
    text = text.replace(/\n{3,}/g, '\n\n')
    
    // Ensure we have some content
    if (!text || text.trim().length < 10) {
      return {
        text: '',
        error: 'PDF appears to be empty or contains only images. Please ensure your PDF has selectable text.',
      }
    }
    
    console.log(`Final text length after cleanup: ${text.length} characters`)
    
    return { text }
  } catch (error) {
    return {
      text: '',
      error: error instanceof Error 
        ? `PDF parsing error: ${error.message}` 
        : 'Failed to extract text from PDF. The PDF may be image-based or corrupted.',
    }
  }
}

