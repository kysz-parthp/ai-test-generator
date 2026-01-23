import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT' as 'STUDENT' | 'TEACHER'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }
      
      login(data.user, data.session?.token || '')
      
      // Redirect based on role
      if (data.user.role === 'TEACHER') {
        router.push('/dashboard/teacher')
      } else {
        router.push('/dashboard/student')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <>
      <Head>
        <title>Sign Up - AI Test Generator</title>
      </Head>
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '3rem', maxWidth: '500px', width: '100%', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#1a202c' }}>Create Account</h1>
          <p style={{ margin: '0 0 2rem 0', color: '#718096' }}>Sign up to get started</p>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && (
              <div style={{ padding: '1rem', background: '#fed7d7', color: '#c53030', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.875rem' }}>I am a:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '1rem', 
                  border: `2px solid ${formData.role === 'STUDENT' ? '#667eea' : '#e2e8f0'}`, 
                  borderRadius: '0.5rem', 
                  cursor: 'pointer',
                  background: formData.role === 'STUDENT' ? '#f7fafc' : 'white'
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="STUDENT"
                    checked={formData.role === 'STUDENT'}
                    onChange={() => setFormData({ ...formData, role: 'STUDENT' })}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontWeight: 600, color: formData.role === 'STUDENT' ? '#667eea' : '#4a5568' }}>Student</span>
                </label>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '1rem', 
                  border: `2px solid ${formData.role === 'TEACHER' ? '#667eea' : '#e2e8f0'}`, 
                  borderRadius: '0.5rem', 
                  cursor: 'pointer',
                  background: formData.role === 'TEACHER' ? '#f7fafc' : 'white'
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="TEACHER"
                    checked={formData.role === 'TEACHER'}
                    onChange={() => setFormData({ ...formData, role: 'TEACHER' })}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontWeight: 600, color: formData.role === 'TEACHER' ? '#667eea' : '#4a5568' }}>Teacher</span>
                </label>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="firstName" style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.875rem' }}>First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="John"
                  style={{ padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '1rem' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="lastName" style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.875rem' }}>Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Doe"
                  style={{ padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '1rem' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="email" style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.875rem' }}>Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="you@example.com"
                style={{ padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '1rem' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="password" style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.875rem' }}>Password</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="••••••••"
                minLength={8}
                style={{ padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '1rem' }}
              />
              <small style={{ color: '#718096', fontSize: '0.75rem' }}>At least 8 characters</small>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="confirmPassword" style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.875rem' }}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="••••••••"
                style={{ padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '1rem' }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                padding: '1rem', 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '0.5rem', 
                fontSize: '1rem', 
                fontWeight: 600, 
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          
          <div style={{ marginTop: '2rem', textAlign: 'center', color: '#718096' }}>
            <p>
              Already have an account?{' '}
              <Link href="/auth/login" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}





