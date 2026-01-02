# Application Flow - Complete Explanation

## 🎯 Overview

This document explains the complete flow of how the AI Test Generator works, from uploading a document to taking a test and viewing results.

---

## 📋 Table of Contents

1. [Teacher Flow: Creating a Test](#teacher-flow-creating-a-test)
2. [Student Flow: Taking a Test](#student-flow-taking-a-test)
3. [Technical Flow: Behind the Scenes](#technical-flow-behind-the-scenes)
4. [Data Flow Diagram](#data-flow-diagram)
5. [Component Interactions](#component-interactions)

---

## 👨‍🏫 Teacher Flow: Creating a Test

### Step 1: Upload Document

**User Action:**
- Teacher navigates to the home page (`/`)
- Drags and drops a file OR clicks to browse
- Selects a TXT, DOCX, or PDF file containing questions

**What Happens:**
```
User Interface (pages/index.tsx)
    ↓
File selected → handleFileSelect()
    ↓
File validated (type check)
    ↓
File state updated → UI shows file name/size
```

**Code Location:** `pages/index.tsx` - `handleFileSelect()`

---

### Step 2: Generate Test

**User Action:**
- Teacher clicks "Generate Test" button

**What Happens:**
```
Frontend (pages/index.tsx)
    ↓
handleSubmit() triggered
    ↓
FormData created with file
    ↓
POST request to /api/upload
    ↓
Progress bar shows (0% → 100%)
```

**Code Location:** `pages/index.tsx` - `handleSubmit()`

---

### Step 3: Backend Processing

**Backend receives request at `pages/api/upload.ts`:**

```
API Route Handler (/api/upload)
    ↓
1. Parse multipart form data (formidable)
    ↓
2. Extract text from file
   - TXT: Direct text read
   - DOCX: mammoth library extracts text
   - PDF: pdf-parse library extracts text
    ↓
3. Send text to OpenAI GPT-4
   - Prompt: "Extract questions from this text..."
   - Model: gpt-4-turbo-preview
   - Response format: JSON
    ↓
4. Parse LLM response
   - Validate structure (Zod schema)
   - Extract questions array
    ↓
5. Validate questions
   - Check each question has text, options, correct answer
    ↓
6. Generate unique share link
   - UUID-based, 16 characters
   - Check database for uniqueness
    ↓
7. Save to database
   - Create Test record
   - Create Question records (one per question)
    ↓
8. Return response
   - shareLink, shareableUrl, questionCount
```

**Code Locations:**
- `pages/api/upload.ts` - Main handler
- `lib/fileParser.ts` - Text extraction
- `lib/llmParser.ts` - AI parsing
- `lib/db.ts` - Database operations
- `prisma/schema.prisma` - Database schema

---

### Step 4: Display Results

**Frontend receives response:**

```
Response received
    ↓
Success state updated
    ↓
UI shows:
  - Success message
  - Shareable link (copyable)
  - Question count
  - "Preview Test" button
```

**Code Location:** `pages/index.tsx` - Success state handling

---

## 👨‍🎓 Student Flow: Taking a Test

### Step 1: Open Test Link

**User Action:**
- Student clicks on shareable link (e.g., `/test/abc123...`)

**What Happens:**
```
Next.js Router
    ↓
Dynamic route: /test/[shareLink]
    ↓
Component: pages/test/[shareLink].tsx
    ↓
useEffect triggered
    ↓
fetchTest(shareLink) called
    ↓
GET request to /api/test/[shareLink]
```

**Code Location:** `pages/test/[shareLink].tsx` - `useEffect()` and `fetchTest()`

---

### Step 2: Load Test Data

**Backend receives request at `pages/api/test/[shareLink].ts`:**

```
API Route Handler (/api/test/[shareLink])
    ↓
1. Extract shareLink from URL
    ↓
2. Query database
   - Find test by shareLink
   - Include related questions
   - Order questions by 'order' field
    ↓
3. Parse question options
   - Options stored as JSON string
   - Convert to JavaScript array
    ↓
4. Return test data
   - Test metadata (id, title, createdAt)
   - Questions array with parsed options
```

**Code Location:** `pages/api/test/[shareLink].ts`

---

### Step 3: Display Questions

**Frontend receives test data:**

```
Response received
    ↓
Test state updated
    ↓
Loading state → false
    ↓
UI renders:
  - Test title
  - Question count
  - Question cards (one per question)
    - Question text
    - Radio button options (A, B, C, D...)
    - Answer selection state
```

**Code Location:** `pages/test/[shareLink].tsx` - Render logic

---

### Step 4: Answer Questions

**User Action:**
- Student clicks on answer options

**What Happens:**
```
User clicks radio button
    ↓
handleAnswerChange() triggered
    ↓
Answers state updated
  - Format: { questionId: "optionIndex" }
    ↓
UI updates:
  - Selected option highlighted
  - Progress bar updates
  - Answer count updates
```

**Code Location:** `pages/test/[shareLink].tsx` - `handleAnswerChange()`

---

### Step 5: Submit Test

**User Action:**
- Student clicks "Submit Test" button

**What Happens:**
```
handleSubmit() triggered
    ↓
Answers object prepared
  - Format: { questionId1: "0", questionId2: "2", ... }
    ↓
POST request to /api/submit/[shareLink]
    ↓
Body: { answers: { ... } }
```

**Code Location:** `pages/test/[shareLink].tsx` - `handleSubmit()`

---

### Step 6: Calculate Results

**Backend receives request at `pages/api/submit/[shareLink].ts`:**

```
API Route Handler (/api/submit/[shareLink])
    ↓
1. Extract shareLink and answers from request
    ↓
2. Query database
   - Find test by shareLink
   - Get all questions with correct answers
    ↓
3. Calculate results for each question
   - Compare user answer with correct answer
   - Mark as correct/incorrect
    ↓
4. Calculate overall score
   - Count correct answers
   - Calculate percentage: (correct / total) * 100
    ↓
5. Return results
   - Results array (one per question)
   - Overall score
   - Correct count / Total count
```

**Code Location:** `pages/api/submit/[shareLink].ts`

---

### Step 7: Display Results

**Frontend receives results:**

```
Response received
    ↓
Results state updated
    ↓
Submitted state → true
    ↓
UI switches to results view:
  - Score display (percentage in circle)
  - Correct/Total count
  - Question-by-question breakdown:
    - ✓ Correct / ✗ Incorrect badge
    - Question text
    - All options with indicators:
      - ✓ Correct Answer (green)
      - ✗ Your Answer (red, if wrong)
```

**Code Location:** `pages/test/[shareLink].tsx` - Results rendering

---

## 🔧 Technical Flow: Behind the Scenes

### Complete Request-Response Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    TEACHER UPLOADS FILE                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: pages/index.tsx                                  │
│  - User selects file                                         │
│  - Creates FormData                                          │
│  - Shows progress bar                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ POST /api/upload
                        │ Content-Type: multipart/form-data
                        │ Body: { file: File }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: pages/api/upload.ts                                │
│  1. Parse form data (formidable)                             │
│  2. Extract text (lib/fileParser.ts)                        │
│     - TXT: file.text()                                       │
│     - DOCX: mammoth.extractRawText()                         │
│     - PDF: pdfParse()                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Text string
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  AI Processing: lib/llmParser.ts                             │
│  - Send to OpenAI GPT-4                                      │
│  - Prompt: "Extract questions..."                            │
│  - Response: JSON with questions array                       │
│  - Validate with Zod schema                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Parsed questions array
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Database: lib/db.ts (Prisma)                               │
│  - Generate unique shareLink                                 │
│  - Create Test record                                        │
│  - Create Question records (JSON options)                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ JSON Response
                        │ { shareLink, shareableUrl, ... }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: pages/index.tsx                                   │
│  - Display success message                                   │
│  - Show shareable link                                       │
│  - Show question count                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              STUDENT OPENS TEST LINK                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: pages/test/[shareLink].tsx                        │
│  - Extract shareLink from URL                                │
│  - Show loading spinner                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ GET /api/test/[shareLink]
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: pages/api/test/[shareLink].ts                      │
│  - Query database by shareLink                               │
│  - Get test + questions                                      │
│  - Parse JSON options to arrays                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ JSON Response
                        │ { test, questions: [...] }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: pages/test/[shareLink].tsx                        │
│  - Render questions with radio buttons                       │
│  - Track answers in state                                    │
│  - Show progress bar                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ User selects answers
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: pages/test/[shareLink].tsx                        │
│  - User clicks "Submit Test"                                 │
│  - Prepare answers object                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ POST /api/submit/[shareLink]
                        │ Body: { answers: {...} }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: pages/api/submit/[shareLink].ts                    │
│  - Get test from database                                    │
│  - Compare user answers with correct answers                 │
│  - Calculate score                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ JSON Response
                        │ { results, score, ... }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: pages/test/[shareLink].tsx                        │
│  - Display score circle                                      │
│  - Show question-by-question results                         │
│  - Highlight correct/incorrect answers                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema Flow

### Test Creation

```
Test Table
├── id: UUID (primary key)
├── title: String (from filename)
├── shareLink: String (unique, 16 chars)
└── createdAt: DateTime

Question Table (related to Test)
├── id: UUID (primary key)
├── testId: UUID (foreign key → Test.id)
├── questionText: String
├── options: String (JSON array: ["A", "B", "C", "D"])
├── correctOptionIndex: Int (0-based)
└── order: Int (question order)
```

### Data Flow Example

**Input (Document):**
```
Question 1: What is 2+2?
A) 3
B) 4
C) 5
D) 6
Answer: B
```

**After LLM Processing:**
```json
{
  "questionText": "What is 2+2?",
  "options": ["3", "4", "5", "6"],
  "correctOptionIndex": 1
}
```

**Stored in Database:**
```
Question {
  questionText: "What is 2+2?",
  options: '["3","4","5","6"]',  // JSON string
  correctOptionIndex: 1
}
```

**Retrieved for Student:**
```json
{
  "questionText": "What is 2+2?",
  "options": ["3", "4", "5", "6"],  // Parsed back to array
  "correctOptionIndex": 1
}
```

---

## 🔄 State Management Flow

### Upload Page State

```typescript
{
  file: File | null              // Selected file
  uploading: boolean            // Upload in progress
  progress: number              // 0-100
  error: string | null           // Error message
  success: {                    // Success data
    shareLink: string
    shareableUrl: string
    questionCount: number
  } | null
  toasts: Toast[]               // Notification toasts
  isDragging: boolean           // Drag state
}
```

### Test Page State

```typescript
{
  test: Test | null             // Test data
  loading: boolean              // Loading test
  error: string | null          // Error message
  answers: {                    // User answers
    [questionId]: optionIndex
  }
  submitted: boolean            // Test submitted
  results: Results | null       // Test results
  submitting: boolean           // Submitting answers
}
```

---

## 🎨 UI Component Flow

### Upload Page Components

```
Home Page (pages/index.tsx)
├── Header
│   ├── Title
│   └── Subtitle
├── Upload Section
│   ├── File Input (drag & drop)
│   ├── Progress Bar (when uploading)
│   ├── Success Message (after upload)
│   └── Submit Button
├── Info Section
│   └── Steps Grid (4 cards)
└── Toast Container
    └── Toast notifications
```

### Test Page Components

```
Test Page (pages/test/[shareLink].tsx)
├── Test Header
│   ├── Title
│   └── Question Count
├── Test Form (if not submitted)
│   ├── Question Cards (multiple)
│   │   ├── Question Number
│   │   ├── Question Text
│   │   └── Options (radio buttons)
│   ├── Progress Tracker
│   └── Submit Button
└── Results Section (if submitted)
    ├── Score Display
    │   ├── Score Circle
    │   └── Correct/Total
    └── Question Results
        └── Result Cards (one per question)
```

---

## 🔐 Security & Validation Flow

### File Upload Validation

```
1. Client-side validation
   - File type check (TXT, DOCX, PDF)
   - File size check (10MB limit)
   
2. Server-side validation
   - File type verification
   - File size limit (formidable config)
   - Text extraction validation
   
3. LLM Response Validation
   - Zod schema validation
   - Question structure check
   - Options array validation
```

### Test Access Validation

```
1. ShareLink validation
   - Must exist in database
   - Must be valid format (16 chars)
   
2. Answer Validation
   - Answer must be valid option index
   - Question must exist
   - Test must exist
```

---

## 📊 Error Handling Flow

### Upload Errors

```
Error Types:
1. Invalid file type → 400 Bad Request
2. File too large → 400 Bad Request
3. Text extraction failed → 400 Bad Request
4. LLM parsing failed → 500 Server Error
5. Database error → 500 Server Error

Error Flow:
Backend → Error response → Frontend → Toast notification
```

### Test Errors

```
Error Types:
1. Test not found → 404 Not Found
2. Invalid shareLink → 400 Bad Request
3. Submit failed → 500 Server Error

Error Flow:
Backend → Error response → Frontend → Error message display
```

---

## 🚀 Performance Optimizations

### Lazy Loading
- Components load on demand
- API calls only when needed

### Progress Indicators
- Real-time upload progress
- Answer completion tracking

### Caching
- Test data cached in component state
- No redundant API calls

---

## 📝 Summary

**Complete Flow in 7 Steps:**

1. **Upload** → Teacher uploads document
2. **Extract** → Backend extracts text from file
3. **Parse** → AI parses questions from text
4. **Store** → Questions saved to database
5. **Share** → Teacher gets shareable link
6. **Take** → Student opens link and answers questions
7. **Score** → System calculates and displays results

**Key Technologies:**
- **Frontend**: React, Next.js, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI GPT-4 Turbo
- **File Parsing**: pdf-parse, mammoth

**Data Formats:**
- **Upload**: multipart/form-data
- **API**: JSON
- **Database**: SQL with JSON strings for arrays

---

This is the complete flow of how the AI Test Generator works from start to finish! 🎉

