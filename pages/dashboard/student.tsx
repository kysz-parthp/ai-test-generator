import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

interface Enrollment {
  id: string
  enrolledAt: string
  class: {
    id: string
    name: string
    description: string | null
    code: string
    teacher: {
      user: {
        firstName: string
        lastName: string
      }
    }
    _count: {
      enrollments: number
    }
  }
}

interface Assignment {
  id: string
  assignedAt: string
  dueDate: string | null
  test: {
    id: string
    title: string | null
    shareLink: string
    _count: {
      questions: number
    }
  }
  class: {
    name: string
    teacher: {
      user: {
        firstName: string
        lastName: string
      }
    }
  }
  latestAttempt: {
    status: string
    score: number | null
  } | null
}

export default function StudentDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    } else if (user?.role !== 'STUDENT') {
      // Redirect non-students
      router.push('/dashboard/teacher')
    } else {
      fetchEnrollments()
      fetchAssignments()
    }
  }, [isAuthenticated, user, router])

  const fetchEnrollments = async () => {
    try {
      const response = await fetch('/api/student/classes')
      const data = await response.json()
      if (response.ok) {
        setEnrollments(data.enrollments)
      }
    } catch (error) {
      console.error('Failed to fetch enrollments:', error)
    }
  }

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/student/assigned-tests')
      const data = await response.json()
      if (response.ok) {
        setAssignments(data.assignments)
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return

    setJoining(true)
    try {
      const response = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() })
      })

      const data = await response.json()
      if (response.ok) {
        alert(data.message)
        setJoinCode('')
        fetchEnrollments() // Refresh the list
      } else {
        alert(data.error || 'Failed to join class')
      }
    } catch (error) {
      console.error('Failed to join class:', error)
      alert('Failed to join class')
    } finally {
      setJoining(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    logout()
    router.push('/auth/login')
  }

  if (!isAuthenticated || user?.role !== 'STUDENT') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>
  }

  return (
    <>
      <Head>
        <title>Student Dashboard - AI Test Generator</title>
      </Head>
      
      <div style={{ minHeight: '100vh', background: '#f7fafc' }}>
        {/* Navigation Bar */}
        <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#667eea', fontSize: '1.5rem' }}>🤖 AI Test Generator</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#4a5568' }}>👨‍🎓 {user.firstName} {user.lastName}</span>
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
            <p style={{ color: '#718096' }}>Here&apos;s your student dashboard</p>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏫</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>{enrollments.length}</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Enrolled Classes</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>{assignments.length}</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Assigned Tests</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>
                {assignments.filter(a => a.latestAttempt?.status === 'COMPLETED').length}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Completed</div>
            </div>
          </div>

          {/* Assigned Tests */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>📝 Assigned Tests</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>Loading...</div>
            ) : assignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                <p>No tests assigned yet. Your teacher will assign tests to your classes.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {assignments.map((assignment) => (
                  <div 
                    key={assignment.id} 
                    style={{ 
                      padding: '1.5rem', 
                      border: '2px solid #e2e8f0', 
                      borderRadius: '0.5rem',
                      background: assignment.latestAttempt?.status === 'COMPLETED' ? '#f0fff4' : 'white'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a202c', fontSize: '1.125rem' }}>
                          {assignment.test.title || 'Untitled Test'}
                        </h3>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#718096', flexWrap: 'wrap' }}>
                          <span>📚 {assignment.class.name}</span>
                          <span>👨‍🏫 {assignment.class.teacher.user.firstName} {assignment.class.teacher.user.lastName}</span>
                          <span>📝 {assignment.test._count.questions} questions</span>
                          {assignment.dueDate && (
                            <span>📅 Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {assignment.latestAttempt?.status === 'COMPLETED' ? (
                          <>
                            <div style={{ 
                              padding: '0.5rem 1rem', 
                              background: '#48bb78',
                              color: 'white',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              fontWeight: 600
                            }}>
                              ✅ Completed
                              {assignment.latestAttempt.score !== null && (
                                <span> • {Math.round(assignment.latestAttempt.score)}%</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <Link
                            href={`/test/${assignment.test.shareLink}`}
                            style={{ 
                              padding: '0.5rem 1.5rem', 
                              background: '#667eea', 
                              color: 'white', 
                              textDecoration: 'none', 
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              fontWeight: 600
                            }}
                          >
                            Start Test
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Join Class */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>🎓 Join a Class</h2>
            <form onSubmit={handleJoinClass} style={{ display: 'flex', gap: '1rem', maxWidth: '500px' }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter join code (e.g., ABC123)"
                maxLength={6}
                style={{ 
                  flex: 1,
                  padding: '0.75rem', 
                  border: '2px solid #e2e8f0', 
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}
              />
              <button
                type="submit"
                disabled={joining || !joinCode.trim()}
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  background: joining || !joinCode.trim() ? '#a0aec0' : '#667eea', 
                  color: 'white', 
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 600,
                  cursor: joining || !joinCode.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {joining ? 'Joining...' : 'Join Class'}
              </button>
            </form>
          </div>

          {/* My Classes */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>🏫 My Classes</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>Loading...</div>
            ) : enrollments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                <p>You haven&apos;t joined any classes yet. Enter a join code above to get started!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {enrollments.map((enrollment) => (
                  <div 
                    key={enrollment.id} 
                    style={{ 
                      padding: '1.5rem', 
                      border: '2px solid #e2e8f0', 
                      borderRadius: '0.5rem',
                      background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'
                    }}
                  >
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a202c', fontSize: '1.125rem' }}>
                      {enrollment.class.name}
                    </h3>
                    {enrollment.class.description && (
                      <p style={{ margin: '0 0 1rem 0', color: '#718096', fontSize: '0.875rem' }}>
                        {enrollment.class.description}
                      </p>
                    )}
                    <div style={{ 
                      padding: '0.75rem', 
                      background: 'white',
                      borderRadius: '0.375rem', 
                      marginBottom: '1rem',
                      borderLeft: '4px solid #667eea'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Teacher</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a202c' }}>
                        {enrollment.class.teacher.user.firstName} {enrollment.class.teacher.user.lastName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#718096' }}>
                      <span>👥 {enrollment.class._count.enrollments} students</span>
                      <span style={{ fontSize: '0.75rem' }}>
                        Joined {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div style={{ background: '#ebf8ff', border: '1px solid #90cdf4', padding: '1.5rem', borderRadius: '0.5rem', marginTop: '2rem' }}>
            <h3 style={{ color: '#2c5282', marginBottom: '0.5rem', fontSize: '1rem' }}>💡 How it works</h3>
            <ul style={{ color: '#2d3748', lineHeight: '1.8', marginLeft: '1.5rem' }}>
              <li>Your teacher will create tests and assign them to your class</li>
              <li>Assigned tests will appear here on your dashboard</li>
              <li>Click on a test to start taking it</li>
              <li>Submit your answers and see results immediately</li>
            </ul>
          </div>
        </main>
      </div>
    </>
  )
}
