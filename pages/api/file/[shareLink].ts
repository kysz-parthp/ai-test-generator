import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/db'
import fs from 'fs'
import path from 'path'

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
    // Get test to find file path
    let test
    try {
      test = await prisma.test.findUnique({
        where: { shareLink },
        select: {
          filePath: true,
          originalFileName: true,
        },
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return res.status(500).json({ error: 'Database error: ' + (dbError instanceof Error ? dbError.message : 'Unknown error') })
    }

    if (!test || !test.filePath) {
      console.error(`Test not found or no file path for shareLink: ${shareLink}`)
      return res.status(404).json({ error: 'File not found' })
    }

    // Construct file path - handle both relative and absolute paths
    let filePath: string
    if (test.filePath.startsWith('/')) {
      // Absolute path
      filePath = test.filePath
    } else {
      // Relative path - join with uploads directory
      filePath = path.join(process.cwd(), 'uploads', test.filePath)
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found at path: ${filePath}`)
      console.error(`Test filePath from DB: ${test.filePath}`)
      console.error(`Current working directory: ${process.cwd()}`)
      console.error(`Uploads directory exists: ${fs.existsSync(path.join(process.cwd(), 'uploads'))}`)
      return res.status(404).json({ error: `File not found on server. Path: ${filePath}` })
    }

    // Check if file is readable
    try {
      fs.accessSync(filePath, fs.constants.R_OK)
    } catch (accessError) {
      console.error(`File is not readable: ${filePath}`, accessError)
      return res.status(403).json({ error: 'File is not readable' })
    }

    // Determine content type based on file extension
    const ext = path.extname(test.filePath).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
    }

    const contentType = contentTypes[ext] || 'application/octet-stream'

    // Get file stats to set content length
    let stats: fs.Stats
    try {
      stats = fs.statSync(filePath)
    } catch (statError) {
      console.error(`Failed to get file stats: ${filePath}`, statError)
      return res.status(500).json({ error: 'Failed to read file information' })
    }
    
    // Read file into buffer and send it
    // This is more reliable than streaming for Next.js API routes
    try {
      const fileBuffer = fs.readFileSync(filePath)
      
      // Set headers for file viewing (inline, not download)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', stats.size)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(test.originalFileName || 'file')}"`)
      
      // Send the file buffer
      return res.send(fileBuffer)
    } catch (readError) {
      console.error('Error reading file:', readError)
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to read file: ' + (readError instanceof Error ? readError.message : 'Unknown error') })
      }
    }
  } catch (error) {
    console.error('Error serving file:', error)
    console.error('Error details:', error instanceof Error ? error.stack : error)
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to serve file',
      })
    }
  }
}

