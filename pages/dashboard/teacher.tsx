import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

interface Test {
  id: string
  title: string
  createdAt: string
  shareLink: string
  originalFileName: string
  status: string
  _count: {
    questions: number
  }
}

interface Class {
  id: string
  name: string
  description: string | null
  code: string
  createdAt: string
  _count: {
    enrollments: number
  }
}

export default function TeacherDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [tests, setTests] = useState<Test[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassDescription, setNewClassDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    } else if (user?.role !== 'TEACHER') {
      // Redirect non-teachers
      router.push('/dashboard/student')
    } else {
      fetchTests()
      fetchClasses()
    }
  }, [isAuthenticated, user, router])

  const fetchTests = async () => {
    try {
      const response = await fetch('/api/teacher/tests')
      const data = await response.json()
      if (response.ok) {
        setTests(data.tests)
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error)
    }
  }

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/teacher/classes')
      const data = await response.json()
      if (response.ok) {
        setClasses(data.classes)
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClassName,
          description: newClassDescription
        })
      })

      const data = await response.json()
      if (response.ok) {
        setClasses([data.class, ...classes])
        setNewClassName('')
        setNewClassDescription('')
        setShowCreateClass(false)
        alert(`Class created! Join code: ${data.class.code}`)
      } else {
        alert(data.error || 'Failed to create class')
      }
    } catch (error) {
      console.error('Failed to create class:', error)
      alert('Failed to create class')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    logout()
    router.push('/auth/login')
  }

  if (!isAuthenticated || user?.role !== 'TEACHER') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>
  }

  return (
    <>
      <Head>
        <title>Teacher Dashboard - AI Test Generator</title>
      </Head>
      
      <div style={{ minHeight: '100vh', background: '#f7fafc' }}>
        {/* Navigation Bar */}
        <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#667eea', fontSize: '1.5rem' }}>🤖 AI Test Generator</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#4a5568' }}>👨‍🏫 {user.firstName} {user.lastName}</span>
              <button 
                onClick={handleLogout}
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: '#e53e3e', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '0.375rem', 
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', color: '#1a202c', marginBottom: '0.5rem' }}>
              Welcome back, {user.firstName}! 👋
            </h1>
            <p style={{ color: '#718096' }}>Here's your teacher dashboard</p>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>{tests.length}</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Tests Created</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>
                {classes.reduce((sum, c) => sum + c._count.enrollments, 0)}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Students</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏫</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>{classes.length}</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Classes</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>Quick Actions</h2>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link 
                href="/"
                style={{ 
                  padding: '1rem 1.5rem', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  color: 'white', 
                  textDecoration: 'none', 
                  borderRadius: '0.5rem', 
                  fontWeight: 600,
                  display: 'inline-block'
                }}
              >
                ✨ Create New Test
              </Link>
              <button
                onClick={() => setShowCreateClass(true)}
                style={{ 
                  padding: '1rem 1.5rem', 
                  background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)', 
                  color: 'white', 
                  border: 'none',
                  borderRadius: '0.5rem', 
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🏫 Create New Class
              </button>
            </div>
          </div>

          {/* Create Class Modal */}
          {showCreateClass && (
            <div style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              background: 'rgba(0,0,0,0.5)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', maxWidth: '500px', width: '90%' }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1a202c' }}>Create New Class</h2>
                <form onSubmit={handleCreateClass}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: 600 }}>
                      Class Name *
                    </label>
                    <input
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="e.g., Mathematics 101"
                      required
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '0.375rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: 600 }}>
                      Description (optional)
                    </label>
                    <textarea
                      value={newClassDescription}
                      onChange={(e) => setNewClassDescription(e.target.value)}
                      placeholder="e.g., Introduction to Algebra"
                      rows={3}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '0.375rem',
                        fontSize: '1rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateClass(false)
                        setNewClassName('')
                        setNewClassDescription('')
                      }}
                      disabled={creating}
                      style={{ 
                        padding: '0.75rem 1.5rem', 
                        background: '#e2e8f0', 
                        color: '#4a5568', 
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !newClassName.trim()}
                      style={{ 
                        padding: '0.75rem 1.5rem', 
                        background: creating ? '#a0aec0' : '#48bb78', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontWeight: 600,
                        cursor: creating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {creating ? 'Creating...' : 'Create Class'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* My Classes */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>🏫 My Classes</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>Loading...</div>
            ) : classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                <p>No classes created yet. Click "Create New Class" to get started!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {classes.map((cls) => (
                  <div 
                    key={cls.id} 
                    style={{ 
                      padding: '1.5rem', 
                      border: '2px solid #e2e8f0', 
                      borderRadius: '0.5rem',
                      background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'
                    }}
                  >
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a202c', fontSize: '1.125rem' }}>
                      {cls.name}
                    </h3>
                    {cls.description && (
                      <p style={{ margin: '0 0 1rem 0', color: '#718096', fontSize: '0.875rem' }}>
                        {cls.description}
                      </p>
                    )}
                    <div style={{ 
                      background: 'white', 
                      padding: '0.75rem', 
                      borderRadius: '0.375rem', 
                      marginBottom: '1rem',
                      border: '2px dashed #667eea'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Join Code</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea', letterSpacing: '0.1em' }}>
                        {cls.code}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#718096' }}>
                      <span>👥 {cls._count.enrollments} students</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cls.code)
                          alert('Join code copied!')
                        }}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: '#667eea', 
                          color: 'white', 
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Copy Code
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Tests */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>📚 My Tests</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>Loading...</div>
            ) : tests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                <p>No tests created yet. Click "Create New Test" to get started!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {tests.map((test) => (
                  <div 
                    key={test.id} 
                    style={{ 
                      padding: '1rem', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a202c', fontSize: '1.125rem' }}>
                        {test.title || 'Untitled Test'}
                      </h3>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#718096' }}>
                        <span>📝 {test._count.questions} questions</span>
                        <span>📅 {new Date(test.createdAt).toLocaleDateString()}</span>
                        <span className={`status-badge ${test.status.toLowerCase()}`} style={{ 
                          padding: '0.25rem 0.5rem', 
                          background: test.status === 'PUBLISHED' ? '#c6f6d5' : '#fed7d7',
                          color: test.status === 'PUBLISHED' ? '#22543d' : '#742a2a',
                          borderRadius: '0.25rem',
                          fontWeight: 600
                        }}>
                          {test.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link 
                        href={`/test/${test.shareLink}`}
                        target="_blank"
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: '#667eea', 
                          color: 'white', 
                          textDecoration: 'none', 
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 600
                        }}
                      >
                        View Test
                      </Link>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/test/${test.shareLink}`
                          navigator.clipboard.writeText(url)
                          alert('Link copied to clipboard!')
                        }}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: '#48bb78', 
                          color: 'white', 
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Getting Started */}
          {tests.length === 0 && !loading && (
            <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>🚀 Getting Started</h2>
              <ol style={{ color: '#4a5568', lineHeight: '1.8' }}>
                <li>Click "Create New Test" to upload a test file (PDF, DOCX, or TXT)</li>
                <li>AI will automatically extract questions and answers</li>
                <li>Get a shareable link to send to your students</li>
                <li>Students take the test and see results immediately</li>
              </ol>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
