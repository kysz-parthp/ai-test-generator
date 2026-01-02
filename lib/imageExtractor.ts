import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse'
import { fromPath } from 'pdf2pic'

/**
 * Get page numbers from PDF
 */
export async function getPdfPagesWithContent(
  pdfPath: string
): Promise<number[]> {
  try {
    const data = fs.readFileSync(pdfPath)
    const pdfData = await pdfParse(data)
    
    // Return all page numbers
    const pages: number[] = []
    for (let i = 1; i <= pdfData.numpages; i++) {
      pages.push(i)
    }
    
    return pages
  } catch (error) {
    console.error('Error reading PDF for pages:', error)
    return []
  }
}

/**
 * Extract images from PDF pages and save them to disk
 * @param pdfPath Path to the PDF file
 * @param shareLink Share link for the test (used for folder naming)
 * @param outputDir Directory to save extracted images
 * @returns Array of image file paths indexed by page number (1-indexed)
 */
export async function extractImagesFromPdf(
  pdfPath: string,
  shareLink: string,
  outputDir: string
): Promise<Map<number, string>> {
  const imageMap = new Map<number, string>()
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Get total number of pages
    const data = fs.readFileSync(pdfPath)
    const pdfData = await pdfParse(data)
    const totalPages = pdfData.numpages

    console.log(`Extracting images from ${totalPages} PDF pages...`)

    // Configure pdf2pic
    const options = {
      density: 200, // DPI - higher quality
      saveFilename: shareLink,
      savePath: outputDir,
      format: 'png',
      width: 2000, // Max width
      height: 2000, // Max height
    }

    const convert = fromPath(pdfPath, options)

    // Extract each page as an image
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const result = await convert(pageNum, { responseType: 'image' })
        
        // pdf2pic returns result with path or name property
        // The file is saved as: {saveFilename}.{pageNum}.{format}
        const imageFileName = `${shareLink}.${pageNum}.png`
        const imagePath = path.join(outputDir, imageFileName)
        
        // Wait a bit for file to be written (pdf2pic is async)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Verify file exists (pdf2pic saves it automatically)
        if (fs.existsSync(imagePath)) {
          imageMap.set(pageNum, imagePath)
          console.log(`  ✓ Extracted image from page ${pageNum}: ${imageFileName}`)
        } else {
          // Try alternative path format
          const altPath = result?.path || result?.name
          if (altPath && fs.existsSync(altPath)) {
            imageMap.set(pageNum, altPath)
            console.log(`  ✓ Extracted image from page ${pageNum} (alternative path)`)
          } else {
            console.warn(`  ⚠ Image file not found for page ${pageNum}. Expected: ${imagePath}`)
          }
        }
      } catch (pageError) {
        console.error(`  ✗ Error extracting page ${pageNum}:`, pageError instanceof Error ? pageError.message : pageError)
        // Continue with other pages
      }
    }

    console.log(`Successfully extracted ${imageMap.size} images from PDF`)
    return imageMap
  } catch (error) {
    console.error('Error extracting images from PDF:', error)
    return imageMap // Return whatever we managed to extract
  }
}

/**
 * Link extracted images to questions based on PDF pages
 * @param questions Array of questions
 * @param pdfPages Array of page numbers
 * @param shareLink Share link for the test
 * @param imageMap Map of page numbers to image file paths
 * @returns Questions with imageUrl set
 */
export function linkImagesToQuestions(
  questions: any[],
  pdfPages: number[],
  shareLink: string,
  imageMap?: Map<number, string>
): any[] {
  return questions.map((q, index) => {
    // Estimate which page the question might be on based on its position
    // Distribute questions across pages proportionally
    const estimatedPage = Math.min(
      Math.floor((index / questions.length) * pdfPages.length) + 1,
      pdfPages.length
    )
    
    // If we have extracted images, use them; otherwise fall back to PDF page reference
    let imageUrl: string | undefined
    if (imageMap && imageMap.has(estimatedPage)) {
      // Use extracted image
      const imagePath = imageMap.get(estimatedPage)!
      const imageFileName = path.basename(imagePath)
      imageUrl = `/api/images/${shareLink}/${imageFileName}`
    } else {
      // Fallback to PDF page reference
      imageUrl = `/api/file/${shareLink}#page=${estimatedPage}`
    }
    
    return {
      ...q,
      imageUrl,
      pageNumber: estimatedPage,
    }
  })
}
