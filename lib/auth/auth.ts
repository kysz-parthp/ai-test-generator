import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

export interface AuthResult {
  success: boolean
  user?: {
    id: string
    email: string
    role: string
    firstName: string
    lastName: string
  }
  session?: {
    token: string
    expiresAt: Date
  }
  error?: string
}

/**
 * Register a new user
 */
export async function registerUser(data: {
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'STUDENT' | 'TEACHER'
}): Promise<AuthResult> {
  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    })
    
    if (existing) {
      return { success: false, error: 'Email already registered' }
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12)
    
    // Create user with profile
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        status: 'ACTIVE',
        emailVerified: new Date(), // Auto-verify for now
        // Create profile based on role
        ...(data.role === 'TEACHER' ? {
          teacherProfile: { create: {} }
        } : {
          studentProfile: { create: {} }
        })
      }
    })
    
    // Create session
    const session = await createSession(user.id)
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      session
    }
  } catch (error) {
    console.error('Registration error:', error)
    return { success: false, error: 'Registration failed' }
  }
}

/**
 * Login user
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    // Check account status
    if (user.status === 'SUSPENDED') {
      return { success: false, error: 'Account suspended' }
    }
    
    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })
    
    // Create session
    const session = await createSession(user.id)
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      session
    }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Login failed' }
  }
}

/**
 * Create session
 */
async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  
  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt
    }
  })
  
  return {
    token: session.token,
    expiresAt: session.expiresAt
  }
}

/**
 * Verify session
 */
export async function verifySession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: true
    }
  })
  
  if (!session || session.expiresAt < new Date()) {
    return null
  }
  
  return session.user
}

/**
 * Logout
 */
export async function logout(token: string) {
  try {
    await prisma.session.delete({
      where: { token }
    })
  } catch (error) {
    // Session might not exist, that's ok
  }
}





