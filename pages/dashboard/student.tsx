import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuthStore } from '@/store/authStore'

export default function StudentDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    } else if (user?.role !== 'STUDENT') {
      // Redirect non-students
      router.push('/dashboard/teacher')
    }
  }, [isAuthenticated, user, router])

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
            <p style={{ color: '#718096' }}>Here's your student dashboard</p>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>0</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Assigned Tests</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>0</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Completed</div>
            </div>
            
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c' }}>-</div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Average Score</div>
            </div>
          </div>

          {/* No Tests Yet */}
          <div style={{ background: 'white', padding: '3rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📝</div>
            <h2 style={{ fontSize: '1.5rem', color: '#1a202c', marginBottom: '0.5rem' }}>No Tests Yet</h2>
            <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
              You don't have any assigned tests at the moment.
            </p>
            <p style={{ color: '#718096', fontSize: '0.875rem' }}>
              Your teacher will assign tests to you. Check back later!
            </p>
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
