# Production Architecture & Roadmap

## Executive Summary

This document outlines the comprehensive architecture for transforming the AI Test Generator from a proof-of-concept (PoC) into a production-ready, scalable web application suitable for real users.

**Current State:** Single-flow PoC where anyone can upload tests and share links
**Target State:** Multi-tenant, role-based platform with separate teacher and student experiences

---

## 1. Role-Based Access Control (RBAC)

### 1.1 User Roles & Permissions

#### **Student Role**
- **Permissions:**
  - View assigned tests
  - Take tests
  - View own test results and history
  - Update own profile
  - View enrolled courses/classes
  
- **Restrictions:**
  - Cannot create tests
  - Cannot view other students' results
  - Cannot access teacher dashboard
  - Cannot modify test content

#### **Teacher Role**
- **Permissions:**
  - All student permissions
  - Create and upload tests
  - Edit/delete own tests
  - View all students' results for their tests
  - Generate test analytics and reports
  - Manage classes/groups
  - Assign tests to students/classes
  - Set test parameters (time limits, attempts, visibility)
  - Export results to CSV/Excel
  
- **Restrictions:**
  - Cannot modify other teachers' tests (unless shared)
  - Cannot access admin functions
  - Cannot manage institution settings

#### **Admin Role** (Future)
- **Permissions:**
  - All teacher permissions
  - Manage users (create, edit, delete, suspend)
  - View system-wide analytics
  - Manage institution settings
  - Access audit logs
  - Configure system parameters
  - Manage subscriptions/billing

#### **Parent Role** (Future)
- **Permissions:**
  - View linked children's test results
  - View progress reports
  - Receive notifications about test completion
  
- **Restrictions:**
  - Cannot take tests
  - Cannot create tests
  - Read-only access to student data

---

## 2. Data Models & Database Schema

### 2.1 Enhanced Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

enum UserRole {
  STUDENT
  TEACHER
  ADMIN
  PARENT
}

enum AccountStatus {
  ACTIVE
  SUSPENDED
  PENDING_VERIFICATION
  DELETED
}

model User {
  id                String         @id @default(uuid())
  email             String         @unique
  emailVerified     DateTime?
  passwordHash      String
  role              UserRole       @default(STUDENT)
  status            AccountStatus  @default(PENDING_VERIFICATION)
  
  // Profile Information
  firstName         String
  lastName          String
  avatar            String?        // URL to profile picture
  phoneNumber       String?
  timezone          String         @default("UTC")
  locale            String         @default("en")
  
  // Metadata
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  lastLoginAt       DateTime?
  
  // Institution/Organization (for multi-tenancy)
  institutionId     String?
  institution       Institution?   @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  
  // Relations
  teacherProfile    TeacherProfile?
  studentProfile    StudentProfile?
  sessions          Session[]
  auditLogs         AuditLog[]
  
  // Indexes
  @@index([email])
  @@index([institutionId])
  @@index([role])
}

model TeacherProfile {
  id                String         @id @default(uuid())
  userId            String         @unique
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Teacher-specific fields
  department        String?
  subject           String?
  bio               String?
  
  // Relations
  tests             Test[]
  classes           Class[]
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
}

model StudentProfile {
  id                String         @id @default(uuid())
  userId            String         @unique
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Student-specific fields
  studentId         String?        // School/Institution student ID
  grade             String?
  
  // Relations
  enrollments       Enrollment[]
  testAttempts      TestAttempt[]
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@index([studentId])
}

// ============================================
// INSTITUTION & MULTI-TENANCY
// ============================================

model Institution {
  id                String         @id @default(uuid())
  name              String
  domain            String?        @unique  // e.g., "school.edu"
  logo              String?
  
  // Settings
  settings          Json?          // Institution-specific settings
  
  // Subscription
  subscriptionTier  String         @default("free")  // free, basic, premium, enterprise
  subscriptionEnds  DateTime?
  
  // Relations
  users             User[]
  classes           Class[]
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@index([domain])
}

// ============================================
// CLASS & ENROLLMENT MANAGEMENT
// ============================================

model Class {
  id                String         @id @default(uuid())
  name              String
  description       String?
  code              String         @unique  // Join code for students
  
  // Teacher
  teacherId         String
  teacher           TeacherProfile @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  
  // Institution
  institutionId     String?
  institution       Institution?   @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  
  // Settings
  isArchived        Boolean        @default(false)
  
  // Relations
  enrollments       Enrollment[]
  testAssignments   TestAssignment[]
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@index([teacherId])
  @@index([code])
  @@index([institutionId])
}

model Enrollment {
  id                String         @id @default(uuid())
  
  studentId         String
  student           StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  classId           String
  class             Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  
  enrolledAt        DateTime       @default(now())
  status            String         @default("active")  // active, dropped, completed
  
  @@unique([studentId, classId])
  @@index([studentId])
  @@index([classId])
}

// ============================================
// TEST MANAGEMENT
// ============================================

enum TestStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum TestVisibility {
  PRIVATE        // Only teacher can see
  ASSIGNED       // Only assigned students can see
  PUBLIC         // Anyone with link can access (current PoC behavior)
}

model Test {
  id                String         @id @default(uuid())
  title             String?
  description       String?
  
  // Owner
  teacherId         String
  teacher           TeacherProfile @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  
  // File Information
  originalFileName  String?
  filePath          String?        // Path to stored file
  
  // Test Settings
  status            TestStatus     @default(DRAFT)
  visibility        TestVisibility @default(PRIVATE)
  shareLink         String         @unique  // Keep for backward compatibility
  
  // Test Configuration
  timeLimit         Int?           // Time limit in minutes
  maxAttempts       Int?           // Max attempts per student (null = unlimited)
  shuffleQuestions  Boolean        @default(false)
  shuffleOptions    Boolean        @default(false)
  showResultsImmediately Boolean   @default(true)
  passingScore      Float?         // Percentage required to pass
  
  // Scheduling
  availableFrom     DateTime?
  availableUntil    DateTime?
  
  // Relations
  questions         Question[]
  assignments       TestAssignment[]
  attempts          TestAttempt[]
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@index([teacherId])
  @@index([shareLink])
  @@index([status])
}

model TestAssignment {
  id                String         @id @default(uuid())
  
  testId            String
  test              Test           @relation(fields: [testId], references: [id], onDelete: Cascade)
  
  classId           String
  class             Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  
  // Assignment-specific settings (override test defaults)
  dueDate           DateTime?
  maxAttempts       Int?
  timeLimit         Int?
  
  assignedAt        DateTime       @default(now())
  
  @@unique([testId, classId])
  @@index([testId])
  @@index([classId])
}

model Question {
  id                 String         @id @default(uuid())
  testId             String
  test               Test           @relation(fields: [testId], references: [id], onDelete: Cascade)
  
  questionText       String
  questionType       String         @default("multiple_choice")
  options            String?        // JSON array of options
  correctOptionIndex Int?
  correctAnswers     String?        // JSON array of correct option indices
  correctText        String?
  correctAnswer      Boolean?       // For true/false questions
  imageUrl           String?
  order              Int            @default(0)
  section            String?
  originalNumber     String?
  matchingPairs      String?
  correctMatches     String?
  hasFillInPart      Boolean        @default(false)
  fillInPrompt       String?
  
  // Question Settings
  points             Float          @default(1.0)  // Points for this question
  
  // Relations
  answers            Answer[]
  
  createdAt          DateTime       @default(now())
  
  @@index([testId])
}

// ============================================
// TEST ATTEMPTS & RESULTS
// ============================================

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  GRADED
  EXPIRED
}

model TestAttempt {
  id                String         @id @default(uuid())
  
  testId            String
  test              Test           @relation(fields: [testId], references: [id], onDelete: Cascade)
  
  studentId         String
  student           StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  // Attempt Information
  attemptNumber     Int            // 1, 2, 3, etc.
  status            AttemptStatus  @default(IN_PROGRESS)
  
  // Timing
  startedAt         DateTime       @default(now())
  submittedAt       DateTime?
  timeSpent         Int?           // Time spent in seconds
  
  // Scoring
  score             Float?         // Percentage score
  pointsEarned      Float?
  pointsTotal       Float?
  passed            Boolean?       // Based on passing score
  
  // Relations
  answers           Answer[]
  
  @@unique([testId, studentId, attemptNumber])
  @@index([testId])
  @@index([studentId])
  @@index([status])
}

model Answer {
  id                String         @id @default(uuid())
  
  attemptId         String
  attempt           TestAttempt    @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  
  questionId        String
  question          Question       @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  // Answer Data
  answerData        Json           // Flexible storage for different answer types
  isCorrect         Boolean?
  pointsEarned      Float?
  
  // Manual Grading (for descriptive questions)
  manuallyGraded    Boolean        @default(false)
  gradedBy          String?        // User ID of grader
  gradedAt          DateTime?
  feedback          String?        // Teacher feedback
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@unique([attemptId, questionId])
  @@index([attemptId])
  @@index([questionId])
}

// ============================================
// AUTHENTICATION & SESSIONS
// ============================================

model Session {
  id                String         @id @default(uuid())
  userId            String
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  token             String         @unique
  expiresAt         DateTime
  
  // Session metadata
  ipAddress         String?
  userAgent         String?
  
  createdAt         DateTime       @default(now())
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}

model PasswordResetToken {
  id                String         @id @default(uuid())
  email             String
  token             String         @unique
  expiresAt         DateTime
  used              Boolean        @default(false)
  
  createdAt         DateTime       @default(now())
  
  @@index([email])
  @@index([token])
}

model EmailVerificationToken {
  id                String         @id @default(uuid())
  email             String
  token             String         @unique
  expiresAt         DateTime
  used              Boolean        @default(false)
  
  createdAt         DateTime       @default(now())
  
  @@index([email])
  @@index([token])
}

// ============================================
// AUDIT & LOGGING
// ============================================

model AuditLog {
  id                String         @id @default(uuid())
  
  userId            String?
  user              User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  action            String         // e.g., "test.create", "user.login", "test.submit"
  entityType        String?        // e.g., "Test", "User", "Class"
  entityId          String?
  
  metadata          Json?          // Additional context
  ipAddress         String?
  userAgent         String?
  
  createdAt         DateTime       @default(now())
  
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}

// ============================================
// NOTIFICATIONS (Future)
// ============================================

model Notification {
  id                String         @id @default(uuid())
  userId            String
  
  type              String         // e.g., "test_assigned", "test_graded", "deadline_reminder"
  title             String
  message           String
  
  read              Boolean        @default(false)
  link              String?        // Link to relevant resource
  
  createdAt         DateTime       @default(now())
  
  @@index([userId])
  @@index([read])
}
```

### 2.2 Migration Strategy

**Phase 1: Add New Tables (Non-Breaking)**
1. Create new tables: User, TeacherProfile, StudentProfile, Class, Enrollment, etc.
2. Keep existing Test and Question tables
3. Add new fields to Test table (teacherId, status, visibility, etc.)

**Phase 2: Data Migration**
1. Create default teacher account for existing tests
2. Migrate existing tests to new schema
3. Update foreign key relationships

**Phase 3: Cleanup**
1. Remove deprecated fields
2. Add constraints and indexes
3. Optimize queries

---

## 3. Authentication & Authorization

### 3.1 Authentication Flow

```typescript
// lib/auth/auth.ts

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
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        status: 'PENDING_VERIFICATION',
        // Create profile based on role
        ...(data.role === 'TEACHER' ? {
          teacherProfile: { create: {} }
        } : {
          studentProfile: { create: {} }
        })
      },
      include: {
        teacherProfile: true,
        studentProfile: true
      }
    })
    
    // Generate email verification token
    await generateEmailVerificationToken(user.email)
    
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
      where: { email: email.toLowerCase() },
      include: {
        teacherProfile: true,
        studentProfile: true
      }
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
    
    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: 'user.login',
      entityType: 'User',
      entityId: user.id
    })
    
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
      user: {
        include: {
          teacherProfile: true,
          studentProfile: true
        }
      }
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
  await prisma.session.delete({
    where: { token }
  })
}

/**
 * Generate email verification token
 */
async function generateEmailVerificationToken(email: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  
  await prisma.emailVerificationToken.create({
    data: {
      email,
      token,
      expiresAt
    }
  })
  
  // TODO: Send verification email
  return token
}

/**
 * Log audit event
 */
async function logAuditEvent(data: {
  userId?: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: any
}) {
  await prisma.auditLog.create({
    data: {
      ...data,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
    }
  })
}
```

### 3.2 Authorization Middleware

```typescript
// lib/auth/authMiddleware.ts

import { NextApiRequest, NextApiResponse } from 'next'
import { verifySession } from './auth'

export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string
    email: string
    role: string
    firstName: string
    lastName: string
    teacherProfile?: any
    studentProfile?: any
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const token = req.cookies.session || req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const user = await verifySession(token)
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    
    ;(req as AuthenticatedRequest).user = user
    
    return handler(req as AuthenticatedRequest, res)
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) => {
    return requireAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      
      return handler(req, res)
    })
  }
}

/**
 * Middleware to require teacher role
 */
export const requireTeacher = requireRole('TEACHER', 'ADMIN')

/**
 * Middleware to require student role
 */
export const requireStudent = requireRole('STUDENT', 'TEACHER', 'ADMIN')

/**
 * Check if user owns resource
 */
export async function checkResourceOwnership(
  userId: string,
  resourceType: 'test' | 'class',
  resourceId: string
): Promise<boolean> {
  const { prisma } = await import('@/lib/db')
  
  if (resourceType === 'test') {
    const test = await prisma.test.findFirst({
      where: {
        id: resourceId,
        teacher: {
          userId
        }
      }
    })
    return !!test
  }
  
  if (resourceType === 'class') {
    const classItem = await prisma.class.findFirst({
      where: {
        id: resourceId,
        teacher: {
          userId
        }
      }
    })
    return !!classItem
  }
  
  return false
}
```

---

## 4. API Architecture

### 4.1 API Structure

```
/api
├── auth/
│   ├── register.ts          # POST - Register new user
│   ├── login.ts             # POST - Login
│   ├── logout.ts            # POST - Logout
│   ├── verify-email.ts      # POST - Verify email
│   ├── forgot-password.ts   # POST - Request password reset
│   └── reset-password.ts    # POST - Reset password
│
├── user/
│   ├── profile.ts           # GET/PUT - Get/update profile
│   └── settings.ts          # GET/PUT - Get/update settings
│
├── teacher/
│   ├── tests/
│   │   ├── index.ts         # GET - List teacher's tests, POST - Create test
│   │   ├── [testId].ts      # GET/PUT/DELETE - Get/update/delete test
│   │   ├── [testId]/assign.ts      # POST - Assign test to class
│   │   ├── [testId]/results.ts     # GET - Get test results
│   │   └── [testId]/analytics.ts   # GET - Get test analytics
│   │
│   ├── classes/
│   │   ├── index.ts         # GET - List classes, POST - Create class
│   │   ├── [classId].ts     # GET/PUT/DELETE - Get/update/delete class
│   │   ├── [classId]/students.ts   # GET - List students in class
│   │   └── [classId]/invite.ts     # POST - Generate invite code
│   │
│   └── grading/
│       └── [attemptId].ts   # PUT - Grade descriptive answers
│
├── student/
│   ├── tests/
│   │   ├── index.ts         # GET - List assigned tests
│   │   ├── [testId].ts      # GET - Get test details
│   │   ├── [testId]/start.ts       # POST - Start test attempt
│   │   └── [testId]/submit.ts      # POST - Submit test
│   │
│   ├── classes/
│   │   ├── index.ts         # GET - List enrolled classes
│   │   └── join.ts          # POST - Join class with code
│   │
│   └── results/
│       ├── index.ts         # GET - List all results
│       └── [attemptId].ts   # GET - Get specific result
│
├── public/
│   └── test/
│       └── [shareLink].ts   # GET - Public test access (legacy)
│
└── upload.ts                # POST - Upload test file (teacher only)
```

### 4.2 Example API Endpoints

```typescript
// pages/api/teacher/tests/index.ts

import { NextApiResponse } from 'next'
import { requireTeacher, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // List teacher's tests
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: req.user.id }
    })
    
    if (!teacherProfile) {
      return res.status(404).json({ error: 'Teacher profile not found' })
    }
    
    const tests = await prisma.test.findMany({
      where: {
        teacherId: teacherProfile.id,
        status: { not: 'ARCHIVED' }
      },
      include: {
        _count: {
          select: {
            questions: true,
            assignments: true,
            attempts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return res.status(200).json({ tests })
  }
  
  if (req.method === 'POST') {
    // Create new test (handled by upload.ts)
    return res.status(405).json({ error: 'Use /api/upload to create tests' })
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

export default requireTeacher(handler)
```

```typescript
// pages/api/student/tests/[testId]/start.ts

import { NextApiResponse } from 'next'
import { requireStudent, AuthenticatedRequest } from '@/lib/auth/authMiddleware'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { testId } = req.query
  
  if (typeof testId !== 'string') {
    return res.status(400).json({ error: 'Invalid test ID' })
  }
  
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: req.user.id }
  })
  
  if (!studentProfile) {
    return res.status(404).json({ error: 'Student profile not found' })
  }
  
  // Check if test is assigned to student
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      assignments: {
        include: {
          class: {
            include: {
              enrollments: {
                where: { studentId: studentProfile.id }
              }
            }
          }
        }
      }
    }
  })
  
  if (!test) {
    return res.status(404).json({ error: 'Test not found' })
  }
  
  // Check if student has access
  const hasAccess = test.assignments.some(
    assignment => assignment.class.enrollments.length > 0
  )
  
  if (!hasAccess && test.visibility !== 'PUBLIC') {
    return res.status(403).json({ error: 'Access denied' })
  }
  
  // Check attempt limits
  const previousAttempts = await prisma.testAttempt.count({
    where: {
      testId,
      studentId: studentProfile.id
    }
  })
  
  if (test.maxAttempts && previousAttempts >= test.maxAttempts) {
    return res.status(403).json({ error: 'Maximum attempts reached' })
  }
  
  // Create new attempt
  const attempt = await prisma.testAttempt.create({
    data: {
      testId,
      studentId: studentProfile.id,
      attemptNumber: previousAttempts + 1,
      status: 'IN_PROGRESS'
    }
  })
  
  return res.status(200).json({ attemptId: attempt.id })
}

export default requireStudent(handler)
```

---

## 5. Frontend Architecture

### 5.1 Routing Strategy

```
/
├── /                          # Landing page (public)
├── /auth/
│   ├── /login                 # Login page
│   ├── /register              # Registration page
│   ├── /verify-email          # Email verification
│   └── /forgot-password       # Password reset
│
├── /dashboard                 # Role-based redirect
│   ├── /teacher               # Teacher dashboard
│   └── /student               # Student dashboard
│
├── /teacher/
│   ├── /tests                 # List of tests
│   ├── /tests/create          # Create new test
│   ├── /tests/[testId]        # View/edit test
│   ├── /tests/[testId]/results # View results
│   ├── /classes               # List of classes
│   ├── /classes/[classId]     # View class
│   └── /grading               # Grading queue
│
├── /student/
│   ├── /tests                 # Assigned tests
│   ├── /tests/[testId]        # Take test
│   ├── /results               # Test results
│   ├── /results/[attemptId]   # View specific result
│   └── /classes               # Enrolled classes
│
├── /public/
│   └── /test/[shareLink]      # Public test access (legacy)
│
└── /settings                  # User settings
```

### 5.2 State Management

**Recommended: Zustand (lightweight, TypeScript-friendly)**

```typescript
// store/authStore.ts

import create from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  role: string
  firstName: string
  lastName: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true
      }),
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false
      }),
      
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      }))
    }),
    {
      name: 'auth-storage'
    }
  )
)
```

```typescript
// store/testStore.ts

import create from 'zustand'

interface TestState {
  currentAttemptId: string | null
  answers: Record<string, any>
  startTime: number | null
  
  startAttempt: (attemptId: string) => void
  setAnswer: (questionId: string, answer: any) => void
  clearAnswers: () => void
}

export const useTestStore = create<TestState>((set) => ({
  currentAttemptId: null,
  answers: {},
  startTime: null,
  
  startAttempt: (attemptId) => set({
    currentAttemptId: attemptId,
    answers: {},
    startTime: Date.now()
  }),
  
  setAnswer: (questionId, answer) => set((state) => ({
    answers: { ...state.answers, [questionId]: answer }
  })),
  
  clearAnswers: () => set({
    currentAttemptId: null,
    answers: {},
    startTime: null
  })
}))
```

### 5.3 Role-Based UI Components

```typescript
// components/RoleGuard.tsx

import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

interface RoleGuardProps {
  allowedRoles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    } else if (user && !allowedRoles.includes(user.role)) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, user, allowedRoles, router])
  
  if (!isAuthenticated || !user || !allowedRoles.includes(user.role)) {
    return fallback || null
  }
  
  return <>{children}</>
}
```

```typescript
// components/ConditionalRender.tsx

import { useAuthStore } from '@/store/authStore'

interface ConditionalRenderProps {
  roles?: string[]
  permissions?: string[]
  children: React.ReactNode
}

export function ConditionalRender({ roles, children }: ConditionalRenderProps) {
  const { user } = useAuthStore()
  
  if (!user) return null
  
  if (roles && !roles.includes(user.role)) {
    return null
  }
  
  return <>{children}</>
}
```

---

## 6. Dashboard Designs

### 6.1 Teacher Dashboard

**Features:**
- Overview statistics (total tests, total students, recent activity)
- Quick actions (Create Test, Create Class, View Reports)
- Recent tests with status indicators
- Upcoming test deadlines
- Grading queue (descriptive questions pending review)
- Recent student activity

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────┐
│  Teacher Dashboard                            [Profile] [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 24 Tests │  │ 156      │  │ 12       │  │ 8 Pending│   │
│  │ Created  │  │ Students │  │ Classes  │  │ Grading  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  Quick Actions:                                               │
│  [+ Create Test] [+ Create Class] [📊 View Reports]          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Recent Tests                              [View All]│    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ • Math Quiz #3          Published    45 attempts    │    │
│  │ • History Midterm       Draft        0 attempts     │    │
│  │ • Science Final         Published    23 attempts    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Grading Queue                         [View All]    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ • Essay Question - History Midterm (8 pending)      │    │
│  │ • Short Answer - Math Quiz (3 pending)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Student Dashboard

**Features:**
- Assigned tests (upcoming, in progress, completed)
- Recent scores and progress
- Enrolled classes
- Upcoming deadlines
- Performance analytics

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────┐
│  Student Dashboard                            [Profile] [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 5 Tests  │  │ 3 Classes│  │ 85%      │  │ 2 Due    │   │
│  │ Assigned │  │ Enrolled │  │ Avg Score│  │ Soon     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Assigned Tests                        [View All]    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 🔴 Math Quiz #3         Due: Tomorrow    [Start]    │    │
│  │ 🟡 History Midterm      Due: 3 days     [Start]     │    │
│  │ ✅ Science Quiz         Completed  92%  [View]      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Recent Results                        [View All]    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ • Science Quiz          92%  ⭐⭐⭐⭐               │    │
│  │ • Math Quiz #2          78%  ⭐⭐⭐                 │    │
│  │ • English Essay         Pending grading             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ My Classes                            [View All]    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ • Mathematics 101       Prof. Smith   24 students   │    │
│  │ • World History         Prof. Johnson 28 students   │    │
│  │ • Biology               Prof. Lee     22 students   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Production Readiness

### 7.1 Environment Configuration

```bash
# .env.production

# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public&sslmode=require"

# Authentication
SESSION_SECRET="your-secret-key-min-32-chars"
JWT_SECRET="your-jwt-secret-key"

# API Keys
OPENAI_API_KEY="sk-..."

# Email Service (SendGrid, AWS SES, etc.)
EMAIL_PROVIDER="sendgrid"
EMAIL_FROM="noreply@yourdomain.com"
SENDGRID_API_KEY="SG...."

# Storage (AWS S3, Cloudinary, etc.)
STORAGE_PROVIDER="s3"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="your-bucket-name"
AWS_REGION="us-east-1"

# Application
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
NODE_ENV="production"

# Monitoring
SENTRY_DSN="https://..."
LOG_LEVEL="info"

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
```

### 7.2 Logging & Monitoring

```typescript
// lib/logger.ts

import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-test-generator' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write errors to file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    // Write all logs to file
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
})

export default logger
```

```typescript
// lib/errorHandler.ts

import { NextApiResponse } from 'next'
import logger from './logger'

export class AppError extends Error {
  statusCode: number
  isOperational: boolean
  
  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export function handleError(error: any, res: NextApiResponse) {
  if (error instanceof AppError) {
    logger.error('Operational error:', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack
    })
    
    return res.status(error.statusCode).json({
      error: error.message
    })
  }
  
  // Unexpected error
  logger.error('Unexpected error:', {
    message: error.message,
    stack: error.stack
  })
  
  return res.status(500).json({
    error: 'An unexpected error occurred'
  })
}
```

### 7.3 Rate Limiting

```typescript
// lib/rateLimit.ts

import { NextApiRequest, NextApiResponse } from 'next'
import { LRUCache } from 'lru-cache'

interface RateLimitOptions {
  interval: number  // Time window in ms
  uniqueTokenPerInterval: number  // Max number of unique tokens
}

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000
  })
  
  return {
    check: (req: NextApiRequest, res: NextApiResponse, limit: number) =>
      new Promise<void>((resolve, reject) => {
        const token = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous'
        const tokenCount = (tokenCache.get(token) as number[]) || [0]
        
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount)
        }
        
        tokenCount[0] += 1
        
        const currentUsage = tokenCount[0]
        const isRateLimited = currentUsage >= limit
        
        res.setHeader('X-RateLimit-Limit', limit)
        res.setHeader('X-RateLimit-Remaining', isRateLimited ? 0 : limit - currentUsage)
        
        if (isRateLimited) {
          res.status(429).json({ error: 'Rate limit exceeded' })
          return reject()
        }
        
        return resolve()
      })
  }
}

// Usage
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
})

export async function withRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  limit: number = 10
) {
  try {
    await limiter.check(req, res, limit)
  } catch {
    return false
  }
  return true
}
```

### 7.4 Deployment Strategy

**Recommended: Vercel (for Next.js)**

**deployment.yml:**
```yaml
# .github/workflows/deploy.yml

name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**Environment Separation:**
- **Development:** Local development with local PostgreSQL
- **Staging:** Staging environment with staging database (Vercel preview deployments)
- **Production:** Production environment with production database

---

## 8. Future Scalability

### 8.1 Adding New Roles

**Steps to add a new role (e.g., PARENT):**

1. **Update Prisma Schema:**
```prisma
enum UserRole {
  STUDENT
  TEACHER
  ADMIN
  PARENT  // New role
}

model ParentProfile {
  id                String         @id @default(uuid())
  userId            String         @unique
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Parent-specific fields
  children          StudentParentLink[]
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
}

model StudentParentLink {
  id                String         @id @default(uuid())
  studentId         String
  student           StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  parentId          String
  parent            ParentProfile  @relation(fields: [parentId], references: [id], onDelete: Cascade)
  
  relationship      String         // "mother", "father", "guardian"
  
  createdAt         DateTime       @default(now())
  
  @@unique([studentId, parentId])
}
```

2. **Update Authentication:**
```typescript
// Add PARENT to registration flow
// Create parent-specific APIs
```

3. **Create Parent Dashboard:**
```typescript
// pages/dashboard/parent.tsx
// pages/parent/children/[studentId]/results.tsx
```

4. **Update Authorization:**
```typescript
export const requireParent = requireRole('PARENT', 'ADMIN')
```

### 8.2 Multi-Tenant Architecture

**Option 1: Shared Database with Tenant Isolation**
- Single database, tenant ID on all tables
- Row-level security (RLS) in PostgreSQL
- Best for: Small to medium scale

**Option 2: Database Per Tenant**
- Separate database for each institution
- Complete data isolation
- Best for: Enterprise customers

**Option 3: Hybrid Approach**
- Shared database for small institutions
- Dedicated database for large institutions
- Best for: Mixed customer base

**Implementation Example (Shared Database):**

```typescript
// lib/tenancy.ts

import { NextApiRequest } from 'next'
import { prisma } from './db'

export async function getTenantId(req: NextApiRequest): Promise<string | null> {
  // Option 1: From subdomain (e.g., school1.yourdomain.com)
  const host = req.headers.host
  const subdomain = host?.split('.')[0]
  
  if (subdomain && subdomain !== 'www') {
    const institution = await prisma.institution.findFirst({
      where: { domain: subdomain }
    })
    return institution?.id || null
  }
  
  // Option 2: From user session
  const user = req.user
  if (user?.institutionId) {
    return user.institutionId
  }
  
  return null
}

// Middleware to inject tenant context
export function withTenancy(
  handler: (req: NextApiRequest & { tenantId: string }, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const tenantId = await getTenantId(req)
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant not found' })
    }
    
    ;(req as any).tenantId = tenantId
    
    return handler(req as any, res)
  }
}
```

**Prisma Middleware for Tenant Isolation:**

```typescript
// lib/db.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Add tenant isolation middleware
prisma.$use(async (params, next) => {
  // Get tenant ID from context (set by request middleware)
  const tenantId = (global as any).currentTenantId
  
  if (!tenantId) {
    return next(params)
  }
  
  // Add tenant filter to all queries
  if (params.model && ['Test', 'Class', 'User'].includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        institutionId: tenantId
      }
    }
    
    if (params.action === 'create' || params.action === 'update') {
      params.args.data = {
        ...params.args.data,
        institutionId: tenantId
      }
    }
  }
  
  return next(params)
})

export { prisma }
```

---

## 9. Security Best Practices

### 9.1 Security Checklist

- [ ] **Authentication:**
  - Secure password hashing (bcrypt with salt rounds ≥ 12)
  - Session tokens with expiration
  - Email verification required
  - Password reset with time-limited tokens
  
- [ ] **Authorization:**
  - Role-based access control (RBAC)
  - Resource ownership checks
  - API endpoint protection
  
- [ ] **Data Protection:**
  - HTTPS only (enforce in production)
  - Encrypted database connections
  - Sensitive data encryption at rest
  - PII (Personally Identifiable Information) handling
  
- [ ] **Input Validation:**
  - Server-side validation for all inputs
  - SQL injection prevention (Prisma ORM)
  - XSS prevention (sanitize user inputs)
  - File upload validation (type, size, content)
  
- [ ] **Rate Limiting:**
  - API rate limiting per user/IP
  - Login attempt limiting
  - File upload rate limiting
  
- [ ] **Audit & Monitoring:**
  - Audit logs for sensitive operations
  - Error logging (without exposing sensitive data)
  - Security event monitoring
  
- [ ] **Dependencies:**
  - Regular dependency updates
  - Security vulnerability scanning
  - Use of trusted packages only

### 9.2 Data Privacy (GDPR/CCPA Compliance)

```typescript
// lib/privacy.ts

/**
 * Export user data (GDPR Article 20 - Right to data portability)
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teacherProfile: {
        include: {
          tests: true,
          classes: true
        }
      },
      studentProfile: {
        include: {
          enrollments: true,
          testAttempts: {
            include: {
              answers: true
            }
          }
        }
      }
    }
  })
  
  return user
}

/**
 * Delete user data (GDPR Article 17 - Right to erasure)
 */
export async function deleteUserData(userId: string) {
  // Anonymize instead of hard delete to preserve data integrity
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.com`,
      firstName: 'Deleted',
      lastName: 'User',
      status: 'DELETED',
      passwordHash: '',
      // Keep relations but anonymize personal data
    }
  })
  
  // Delete sessions
  await prisma.session.deleteMany({
    where: { userId }
  })
}
```

---

## 10. Migration Path from PoC to Production

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up new database schema
- [ ] Implement authentication system
- [ ] Create user registration/login flows
- [ ] Build role-based routing
- [ ] Set up development/staging/production environments

### Phase 2: Core Features (Weeks 3-4)
- [ ] Teacher dashboard
- [ ] Student dashboard
- [ ] Class management (create, join, manage)
- [ ] Test assignment system
- [ ] Update test creation flow with ownership

### Phase 3: Enhanced Features (Weeks 5-6)
- [ ] Test attempt tracking
- [ ] Results and analytics
- [ ] Grading interface for descriptive questions
- [ ] Email notifications
- [ ] Profile management

### Phase 4: Polish & Testing (Weeks 7-8)
- [ ] UI/UX improvements
- [ ] Comprehensive testing (unit, integration, e2e)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation

### Phase 5: Deployment (Week 9)
- [ ] Production deployment
- [ ] Data migration (if needed)
- [ ] Monitoring setup
- [ ] User onboarding materials

### Phase 6: Post-Launch (Ongoing)
- [ ] User feedback collection
- [ ] Bug fixes
- [ ] Feature iterations
- [ ] Performance monitoring

---

## 11. Key Recommendations

### Technical Recommendations
1. **Use TypeScript throughout** - Type safety prevents bugs
2. **Implement proper error boundaries** - Graceful error handling
3. **Add comprehensive logging** - Essential for debugging production issues
4. **Use database transactions** - Ensure data consistency
5. **Implement caching** - Redis for session storage and frequently accessed data
6. **Add search functionality** - Elasticsearch or PostgreSQL full-text search
7. **Optimize database queries** - Use indexes, avoid N+1 queries
8. **Implement file storage service** - S3 or Cloudinary instead of local storage

### Product Recommendations
1. **Start with core features** - Don't over-engineer initially
2. **Gather user feedback early** - Beta testing with real teachers/students
3. **Focus on UX** - Intuitive interfaces for non-technical users
4. **Mobile-first design** - Many students use mobile devices
5. **Accessibility** - WCAG 2.1 AA compliance
6. **Internationalization** - Support multiple languages from the start
7. **Analytics dashboard** - Help teachers understand student performance
8. **Gamification** - Badges, streaks, leaderboards for student engagement

### Business Recommendations
1. **Freemium model** - Free tier for individual teachers, paid for institutions
2. **Tiered pricing** - Based on number of students/tests/features
3. **API access** - Allow integrations with LMS systems (Canvas, Moodle)
4. **White-label option** - For large institutions
5. **Support system** - Help desk, documentation, video tutorials
6. **Community building** - Forums, teacher resource sharing

---

## Conclusion

This architecture provides a solid foundation for transforming your PoC into a production-ready application. The key is to:

1. **Start simple** - Implement core RBAC and dashboards first
2. **Iterate based on feedback** - Real users will guide feature priorities
3. **Maintain code quality** - TypeScript, tests, documentation
4. **Plan for scale** - Multi-tenancy, caching, optimization
5. **Focus on security** - Authentication, authorization, data protection

The architecture is designed to be:
- **Scalable** - Can grow from 10 to 10,000+ users
- **Maintainable** - Clear separation of concerns, modular design
- **Secure** - Industry-standard security practices
- **Extensible** - Easy to add new roles, features, integrations

Good luck with your production launch! 🚀



