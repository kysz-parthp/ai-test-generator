import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

export default function TeacherDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    } else if (user?.role !== 'TEACHER') {
      // Redirect non-teachers
      router.push('/dashboard/student')
    }
  }, [isAuthenticated, user, router])

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
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>0</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Tests Created</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>0</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Students</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏫</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>0</div>
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
            </div>
          </div>

          {/* Getting Started */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '1rem' }}>🚀 Getting Started</h2>
            <ol style={{ color: '#4a5568', lineHeight: '1.8' }}>
              <li>Click "Create New Test" to upload a test file (PDF, DOCX, or TXT)</li>
              <li>AI will automatically extract questions and answers</li>
              <li>Get a shareable link to send to your students</li>
              <li>Students take the test and see results immediately</li>
            </ol>
          </div>
        </main>
      </div>
    </>
  )
}
