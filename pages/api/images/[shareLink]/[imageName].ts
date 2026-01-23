import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { shareLink, imageName } = req.query

  if (typeof shareLink !== 'string' || typeof imageName !== 'string') {
    return res.status(400).json({ error: 'Invalid share link or image name' })
  }

  try {
    // Construct image path
    const imagePath = path.join(
      process.cwd(),
      'uploads',
      'images',
      shareLink,
      imageName
    )

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' })
    }

    // Check if file is readable
    try {
      fs.accessSync(imagePath, fs.constants.R_OK)
    } catch (accessError) {
      return res.status(403).json({ error: 'Image is not readable' })
    }

    // Get file stats
    const stats = fs.statSync(imagePath)

    // Determine content type based on file extension
    const ext = path.extname(imageName).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }

    const contentType = contentTypes[ext] || 'image/png'

    // Read and send image
    const imageBuffer = fs.readFileSync(imagePath)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stats.size)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // Cache for 1 year

    return res.send(imageBuffer)
  } catch (error) {
    console.error('Error serving image:', error)
    return res.status(500).json({
      error: 'Failed to serve image',
    })
  }
}









