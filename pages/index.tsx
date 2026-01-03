import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import ProgressBar from '@/components/ProgressBar'
import { ToastContainer } from '@/components/Toast'
import { useAuthStore } from '@/store/authStore'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export default function Home() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [success, setSuccess] = useState<{
    shareLink: string
    shareableUrl: string
    fileUrl: string
    originalFileName: string
    questionCount?: number
  } | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  // Show loading while redirecting
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <LoadingSpinner size="large" />
      </div>
    )
  }

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const validateFile = (selectedFile: File): boolean => {
    const validTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    const validExtensions = ['.txt', '.pdf', '.docx']

    return (
      validTypes.includes(selectedFile.type) ||
      validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext))
    )
  }

  const handleFileSelect = (selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile)
      setError(null)
      addToast('File selected successfully', 'success')
    } else {
      setError('Please upload a TXT, DOCX, or PDF file')
      setFile(null)
      addToast('Invalid file type. Please use TXT, DOCX, or PDF', 'error')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccess(null)
    setProgress(0)

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + 10
      })
    }, 500)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(data)
      setFile(null)
      addToast(
        data.questionCount 
          ? `Successfully created test with ${data.questionCount} questions!` 
          : `File uploaded successfully! Share the link to access the file.`, 
        'success'
      )
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err) {
      clearInterval(progressInterval)
      setProgress(0)
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      addToast(errorMessage, 'error')
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  return (
    <>
      <Head>
        <title>AI Test Generator</title>
        <meta name="description" content="Convert documents into interactive tests" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="container">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        <div className="header">
          <h1>🤖 AI Test Generator</h1>
          <p className="subtitle">
            Upload a question paper and get an interactive test with all questions extracted exactly as they appear
          </p>
        </div>

        <div className="upload-section">
          <form onSubmit={handleSubmit} className="upload-form">
            <div
              className={`file-input-wrapper ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label htmlFor="file-input" className="file-label">
                {uploading ? (
                  <div className="uploading-state">
                    <LoadingSpinner size="medium" />
                    <span className="uploading-text">Processing your file...</span>
                  </div>
                ) : file ? (
                  <div className="file-selected-state">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setFile(null)
                        const fileInput = document.getElementById('file-input') as HTMLInputElement
                        if (fileInput) fileInput.value = ''
                      }}
                      className="remove-file-button"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="file-empty-state">
                    <span className="upload-icon">📤</span>
                    <span className="file-label-text">
                      Drag and drop a file here, or click to browse
                    </span>
                    <span className="file-label-hint">
                      Supports TXT, DOCX, and PDF files
                    </span>
                  </div>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={handleFileChange}
                  className="file-input"
                  disabled={uploading}
                />
              </label>
            </div>

            {uploading && (
              <div className="progress-section">
                <ProgressBar progress={progress} label="Processing..." />
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {success && (
              <div className="success-message">
                <h3>Test created successfully!</h3>
                <p>
                  {success.questionCount ? (
                    <>
                      <strong>{success.questionCount}</strong> questions extracted from{' '}
                      <strong>{success.originalFileName}</strong>
                    </>
                  ) : (
                    <>
                      Your file <strong>{success.originalFileName}</strong> is ready to share
                    </>
                  )}
                </p>
                <div className="share-link-container">
                  <label>Test Link:</label>
                  <div className="link-display">
                    <input
                      type="text"
                      value={success.shareableUrl}
                      readOnly
                      className="link-input"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(success.shareableUrl)
                        addToast('Link copied to clipboard!', 'success')
                      }}
                      className="copy-button"
                    >
                      Copy
                    </button>
                  </div>
                  <Link href={success.shareableUrl} className="preview-link">
                    Open Test →
                  </Link>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Students can view the question paper and submit their answers to get instant results.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || uploading}
              className="submit-button"
            >
              {uploading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Extract Questions & Create Test</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="info-section">
          <h2>✨ How it works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Upload Document</h3>
              <p>Upload your TXT, DOCX, or PDF file with questions</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>AI Extraction</h3>
              <p>AI extracts ALL questions exactly as they appear in your document - same wording, same options, no generation</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Get Link</h3>
              <p>Receive a unique shareable link for your test</p>
            </div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Share & Test</h3>
              <p>Students take the test and see results immediately</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

