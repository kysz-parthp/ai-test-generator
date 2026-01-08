# Production Implementation Guide

This guide provides step-by-step instructions and code examples for implementing the production architecture.

---

## Quick Start: Priority Implementation Order

### 🔴 **Phase 1: Critical (Week 1-2)**
1. Authentication system
2. User roles and profiles
3. Basic dashboards
4. Database migration

### 🟡 **Phase 2: Important (Week 3-4)**
5. Class management
6. Test assignment
7. Test attempt tracking
8. Results viewing

### 🟢 **Phase 3: Enhancement (Week 5-6)**
9. Analytics and reporting
10. Email notifications
11. Grading interface
12. Advanced features

---

## Step 1: Update Database Schema

### 1.1 Backup Current Data

```bash
# Export current database
pg_dump -h localhost -U postgres ai_test_generator > backup_$(date +%Y%m%d).sql

# Or using Prisma
npx prisma db pull
```

### 1.2 Update Prisma Schema

Replace your current `prisma/schema.prisma` with the enhanced schema from `PRODUCTION_ARCHITECTURE.md`.

### 1.3 Generate and Apply Migration

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_user_roles_and_profiles

# Apply to production (when ready)
npx prisma migrate deploy
```

### 1.4 Seed Database with Test Data

```typescript
// prisma/seed.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create test teacher
  const teacherPassword = await bcrypt.hash('teacher123', 12)
  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@test.com',
      passwordHash: teacherPassword,
      firstName: 'John',
      lastName: 'Teacher',
      role: 'TEACHER',
      status: 'ACTIVE',
      emailVerified: new Date(),
      teacherProfile: {
        create: {
          department: 'Mathematics',
          subject: 'Algebra'
        }
      }
    }
  })
  
  // Create test students
  const studentPassword = await bcrypt.hash('student123', 12)
  const students = await Promise.all([
    prisma.user.create({
      data: {
        email: 'student1@test.com',
        passwordHash: studentPassword,
        firstName: 'Alice',
        lastName: 'Student',
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerified: new Date(),
        studentProfile: {
          create: {
            studentId: 'STU001',
            grade: '10'
          }
        }
      }
    }),
    prisma.user.create({
      data: {
        email: 'student2@test.com',
        passwordHash: studentPassword,
        firstName: 'Bob',
        lastName: 'Student',
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerified: new Date(),
        studentProfile: {
          create: {
            studentId: 'STU002',
            grade: '10'
          }
        }
      }
    })
  ])
  
  // Create test class
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: teacher.id }
  })
  
  const testClass = await prisma.class.create({
    data: {
      name: 'Algebra 101',
      description: 'Introduction to Algebra',
      code: 'ALG101',
      teacherId: teacherProfile!.id,
      enrollments: {
        create: students.map(student => ({
          studentId: student.studentProfile!.id
        }))
      }
    }
  })
  
  console.log('✅ Seed data created successfully')
  console.log('Teacher:', teacher.email, '/ teacher123')
  console.log('Students:', students.map(s => s.email).join(', '), '/ student123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

```bash
# Run seed
npx ts-node prisma/seed.ts
```

---

## Step 2: Implement Authentication

### 2.1 Install Dependencies

```bash
npm install bcryptjs jsonwebtoken cookie
npm install -D @types/bcryptjs @types/jsonwebtoken @types/cookie
```

### 2.2 Create Authentication Library

Create the file from the architecture document:

```typescript
// lib/auth/auth.ts
// (Copy from PRODUCTION_ARCHITECTURE.md Section 3.1)
```

### 2.3 Create Authentication Middleware

```typescript
// lib/auth/authMiddleware.ts
// (Copy from PRODUCTION_ARCHITECTURE.md Section 3.2)
```

### 2.4 Create Auth API Endpoints

```typescript
// pages/api/auth/register.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { registerUser } from '@/lib/auth/auth'
import { z } from 'zod'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['STUDENT', 'TEACHER'])
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const data = RegisterSchema.parse(req.body)
    const result = await registerUser(data)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }
    
    // Set session cookie
    res.setHeader('Set-Cookie', `session=${result.session!.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`)
    
    return res.status(200).json({
      success: true,
      user: result.user
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Registration error:', error)
    return res.status(500).json({ error: 'Registration failed' })
  }
}
```

```typescript
// pages/api/auth/login.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { loginUser } from '@/lib/auth/auth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email, password } = req.body
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  
  const result = await loginUser(email, password)
  
  if (!result.success) {
    return res.status(401).json({ error: result.error })
  }
  
  // Set session cookie
  res.setHeader('Set-Cookie', `session=${result.session!.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`)
  
  return res.status(200).json({
    success: true,
    user: result.user
  })
}
```

```typescript
// pages/api/auth/logout.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { logout } from '@/lib/auth/auth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const token = req.cookies.session
  
  if (token) {
    await logout(token)
  }
  
  // Clear session cookie
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0')
  
  return res.status(200).json({ success: true })
}
```

```typescript
// pages/api/auth/me.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/authMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  return res.status(200).json({ user: req.user })
}

export default requireAuth(handler)
```

### 2.5 Create Auth Pages

```typescript
// pages/auth/login.tsx

import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      
      login(data.user, data.session?.token || '')
      
      // Redirect based on role
      if (data.user.role === 'TEACHER') {
        router.push('/dashboard/teacher')
      } else if (data.user.role === 'STUDENT') {
        router.push('/dashboard/student')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <>
      <Head>
        <title>Login - AI Test Generator</title>
      </Head>
      <main className="auth-container">
        <div className="auth-card">
          <h1>Welcome Back</h1>
          <p className="subtitle">Sign in to your account</p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link href="/auth/register">Sign up</Link>
            </p>
            <Link href="/auth/forgot-password">Forgot password?</Link>
          </div>
        </div>
      </main>
    </>
  )
}
```

```typescript
// pages/auth/register.tsx

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
      <main className="auth-container">
        <div className="auth-card">
          <h1>Create Account</h1>
          <p className="subtitle">Sign up to get started</p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label>I am a:</label>
              <div className="role-selector">
                <label className={`role-option ${formData.role === 'STUDENT' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="STUDENT"
                    checked={formData.role === 'STUDENT'}
                    onChange={(e) => setFormData({ ...formData, role: 'STUDENT' })}
                  />
                  <span>Student</span>
                </label>
                <label className={`role-option ${formData.role === 'TEACHER' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="TEACHER"
                    checked={formData.role === 'TEACHER'}
                    onChange={(e) => setFormData({ ...formData, role: 'TEACHER' })}
                  />
                  <span>Teacher</span>
                </label>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="John"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="you@example.com"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="••••••••"
                minLength={8}
              />
              <small>At least 8 characters</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="••••••••"
              />
            </div>
            
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link href="/auth/login">Sign in</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
```

### 2.6 Add Auth Styles

```css
/* styles/auth.css */

.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.auth-card {
  background: white;
  border-radius: 1rem;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-card h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #1a202c;
}

.auth-card .subtitle {
  margin: 0 0 2rem 0;
  color: #718096;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.875rem;
}

.form-group input {
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group small {
  color: #718096;
  font-size: 0.75rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.role-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.role-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.role-option input {
  display: none;
}

.role-option span {
  font-weight: 600;
  color: #4a5568;
}

.role-option.selected {
  border-color: #667eea;
  background: #f7fafc;
}

.role-option.selected span {
  color: #667eea;
}

.submit-button {
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-footer {
  margin-top: 2rem;
  text-align: center;
  color: #718096;
}

.auth-footer a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.auth-footer a:hover {
  text-decoration: underline;
}

.error-message {
  padding: 1rem;
  background: #fed7d7;
  color: #c53030;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}
```

Import in `_app.tsx`:

```typescript
import '@/styles/auth.css'
```

---

## Step 3: Update Upload API for Teachers

### 3.1 Protect Upload Endpoint

```typescript
// pages/api/upload.ts

import type { NextApiResponse } from 'next'
import { requireTeacher, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'
// ... other imports

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Get teacher profile
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: req.user.id }
    })
    
    if (!teacherProfile) {
      return res.status(404).json({ error: 'Teacher profile not found' })
    }
    
    // ... existing file parsing logic ...
    
    // Save to database with teacher ownership
    const test = await prisma.test.create({
      data: {
        shareLink,
        title: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: formidableFile.originalFilename || file.name,
        filePath: fileName,
        teacherId: teacherProfile.id,  // Add teacher ownership
        status: 'DRAFT',  // Start as draft
        visibility: 'PRIVATE',  // Private by default
        questions: {
          create: questions.map((q, index) => ({
            // ... existing question data ...
          }))
        }
      },
      include: {
        questions: true
      }
    })
    
    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'test.create',
        entityType: 'Test',
        entityId: test.id,
        metadata: {
          questionCount: questions.length,
          fileName: test.originalFileName
        }
      }
    })
    
    return res.status(200).json({
      success: true,
      testId: test.id,
      shareLink,
      questionCount: questions.length
    })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process file'
    })
  }
}

export default requireTeacher(handler)
```

---

## Step 4: Create Teacher Dashboard

```typescript
// pages/dashboard/teacher.tsx

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/store/authStore'
import { RoleGuard } from '@/components/RoleGuard'

interface DashboardStats {
  testsCount: number
  studentsCount: number
  classesCount: number
  pendingGradingCount: number
}

interface Test {
  id: string
  title: string
  status: string
  createdAt: string
  _count: {
    questions: number
    attempts: number
  }
}

export default function TeacherDashboard() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTests, setRecentTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchDashboardData()
  }, [])
  
  const fetchDashboardData = async () => {
    try {
      const [statsRes, testsRes] = await Promise.all([
        fetch('/api/teacher/stats'),
        fetch('/api/teacher/tests?limit=5')
      ])
      
      const statsData = await statsRes.json()
      const testsData = await testsRes.json()
      
      setStats(statsData)
      setRecentTests(testsData.tests)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div>Loading...</div>
  }
  
  return (
    <RoleGuard allowedRoles={['TEACHER', 'ADMIN']}>
      <Head>
        <title>Teacher Dashboard - AI Test Generator</title>
      </Head>
      
      <main className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <h1>Welcome back, {user?.firstName}!</h1>
            <p className="subtitle">Here's what's happening with your tests</p>
          </div>
          <Link href="/teacher/tests/create" className="primary-button">
            + Create Test
          </Link>
        </header>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.testsCount || 0}</div>
              <div className="stat-label">Tests Created</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.studentsCount || 0}</div>
              <div className="stat-label">Students</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏫</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.classesCount || 0}</div>
              <div className="stat-label">Classes</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✍️</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.pendingGradingCount || 0}</div>
              <div className="stat-label">Pending Grading</div>
            </div>
          </div>
        </div>
        
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Tests</h2>
            <Link href="/teacher/tests">View All →</Link>
          </div>
          
          <div className="tests-list">
            {recentTests.length === 0 ? (
              <div className="empty-state">
                <p>No tests yet. Create your first test to get started!</p>
                <Link href="/teacher/tests/create" className="primary-button">
                  Create Test
                </Link>
              </div>
            ) : (
              recentTests.map(test => (
                <div key={test.id} className="test-card">
                  <div className="test-info">
                    <h3>{test.title || 'Untitled Test'}</h3>
                    <div className="test-meta">
                      <span className={`status-badge ${test.status.toLowerCase()}`}>
                        {test.status}
                      </span>
                      <span>{test._count.questions} questions</span>
                      <span>{test._count.attempts} attempts</span>
                    </div>
                  </div>
                  <div className="test-actions">
                    <Link href={`/teacher/tests/${test.id}`} className="button-secondary">
                      View
                    </Link>
                    <Link href={`/teacher/tests/${test.id}/results`} className="button-secondary">
                      Results
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </RoleGuard>
  )
}
```

---

## Step 5: Create Student Dashboard

```typescript
// pages/dashboard/student.tsx

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { RoleGuard } from '@/components/RoleGuard'

interface AssignedTest {
  id: string
  title: string
  dueDate: string | null
  status: 'pending' | 'in_progress' | 'completed'
  score?: number
  attempts: number
  maxAttempts: number | null
}

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const [assignedTests, setAssignedTests] = useState<AssignedTest[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchAssignedTests()
  }, [])
  
  const fetchAssignedTests = async () => {
    try {
      const response = await fetch('/api/student/tests')
      const data = await response.json()
      setAssignedTests(data.tests)
    } catch (error) {
      console.error('Failed to fetch tests:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green'
      case 'in_progress': return 'yellow'
      default: return 'red'
    }
  }
  
  if (loading) {
    return <div>Loading...</div>
  }
  
  return (
    <RoleGuard allowedRoles={['STUDENT']}>
      <Head>
        <title>Student Dashboard - AI Test Generator</title>
      </Head>
      
      <main className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <h1>Welcome back, {user?.firstName}!</h1>
            <p className="subtitle">Your assigned tests and progress</p>
          </div>
        </header>
        
        <div className="dashboard-section">
          <h2>Assigned Tests</h2>
          
          <div className="tests-list">
            {assignedTests.length === 0 ? (
              <div className="empty-state">
                <p>No tests assigned yet. Check back later!</p>
              </div>
            ) : (
              assignedTests.map(test => (
                <div key={test.id} className="test-card">
                  <div className="test-info">
                    <h3>{test.title}</h3>
                    <div className="test-meta">
                      <span className={`status-indicator ${getStatusColor(test.status)}`}>
                        {test.status === 'completed' ? '✓' : test.status === 'in_progress' ? '⏳' : '○'}
                      </span>
                      {test.dueDate && (
                        <span className="due-date">
                          Due: {new Date(test.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {test.score !== undefined && (
                        <span className="score">Score: {test.score}%</span>
                      )}
                    </div>
                  </div>
                  <div className="test-actions">
                    {test.status === 'completed' ? (
                      <Link href={`/student/results/${test.id}`} className="button-secondary">
                        View Results
                      </Link>
                    ) : (
                      <Link href={`/student/tests/${test.id}`} className="primary-button">
                        {test.status === 'in_progress' ? 'Continue' : 'Start Test'}
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </RoleGuard>
  )
}
```

---

## Step 6: Add Navigation & Layout

```typescript
// components/Layout.tsx

import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuthStore()
  const router = useRouter()
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    logout()
    router.push('/auth/login')
  }
  
  if (!isAuthenticated) {
    return <>{children}</>
  }
  
  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <Link href="/">AI Test Generator</Link>
        </div>
        
        <div className="navbar-menu">
          {user?.role === 'TEACHER' && (
            <>
              <Link href="/dashboard/teacher">Dashboard</Link>
              <Link href="/teacher/tests">Tests</Link>
              <Link href="/teacher/classes">Classes</Link>
            </>
          )}
          
          {user?.role === 'STUDENT' && (
            <>
              <Link href="/dashboard/student">Dashboard</Link>
              <Link href="/student/tests">Tests</Link>
              <Link href="/student/classes">Classes</Link>
            </>
          )}
          
          <div className="navbar-user">
            <span>{user?.firstName} {user?.lastName}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>
      
      <div className="content">
        {children}
      </div>
    </div>
  )
}
```

Update `_app.tsx`:

```typescript
// pages/_app.tsx

import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useAuthStore } from '@/store/authStore'
import '@/styles/globals.css'
import '@/styles/auth.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  
  useEffect(() => {
    // Check authentication on mount
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (!response.ok) {
          // Not authenticated
          if (!router.pathname.startsWith('/auth') && router.pathname !== '/') {
            router.push('/auth/login')
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
      }
    }
    
    checkAuth()
  }, [router.pathname])
  
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
```

---

## Step 7: Testing Checklist

### Manual Testing

- [ ] **Authentication:**
  - [ ] Register as teacher
  - [ ] Register as student
  - [ ] Login as teacher
  - [ ] Login as student
  - [ ] Logout
  - [ ] Invalid credentials
  - [ ] Session persistence

- [ ] **Teacher Flow:**
  - [ ] Access teacher dashboard
  - [ ] Upload test file
  - [ ] View test list
  - [ ] View test details
  - [ ] Cannot access student pages

- [ ] **Student Flow:**
  - [ ] Access student dashboard
  - [ ] View assigned tests
  - [ ] Cannot access teacher pages
  - [ ] Cannot upload tests

- [ ] **Security:**
  - [ ] Cannot access protected routes without login
  - [ ] Cannot access other role's pages
  - [ ] Session expires correctly

---

## Next Steps

After completing these steps, you'll have:
✅ User authentication system
✅ Role-based access control
✅ Separate teacher and student dashboards
✅ Protected API endpoints
✅ Test ownership and permissions

**Continue with:**
1. Class management (create, join, manage)
2. Test assignment system
3. Test attempt tracking
4. Results and analytics
5. Grading interface

Refer to `PRODUCTION_ARCHITECTURE.md` for detailed specifications on these features.



