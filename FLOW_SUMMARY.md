# Application Flow - Quick Summary

## 🎯 Simple Overview

### Teacher Side (Creating Test)

```
1. Upload File
   📄 Teacher selects TXT/DOCX/PDF file
   ↓
2. Process File
   🔧 Backend extracts text from file
   ↓
3. AI Parsing
   🤖 GPT-4 extracts questions, options, answers
   ↓
4. Save to Database
   💾 Store test and questions
   ↓
5. Get Link
   🔗 Receive shareable link
```

### Student Side (Taking Test)

```
1. Open Link
   🔗 Student clicks shareable link
   ↓
2. Load Questions
   📋 Backend fetches test from database
   ↓
3. Answer Questions
   ✏️ Student selects answers
   ↓
4. Submit Test
   📤 Send answers to backend
   ↓
5. View Results
   ✅ See score and correct/incorrect answers
```

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TEACHER WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

[Teacher Browser]
    │
    │ 1. Upload file (drag & drop)
    ▼
[Frontend: pages/index.tsx]
    │
    │ 2. POST /api/upload (FormData with file)
    ▼
[Backend: pages/api/upload.ts]
    │
    │ 3. Extract text
    ▼
[lib/fileParser.ts]
    │ - TXT: Read directly
    │ - DOCX: Use mammoth
    │ - PDF: Use pdf-parse
    │
    │ 4. Send to AI
    ▼
[lib/llmParser.ts]
    │ - Call OpenAI GPT-4
    │ - Parse JSON response
    │ - Validate structure
    │
    │ 5. Save to database
    ▼
[lib/db.ts + Prisma]
    │ - Create Test record
    │ - Create Question records
    │
    │ 6. Return shareLink
    ▼
[Frontend: pages/index.tsx]
    │ - Display success
    │ - Show shareable link
    │
    │ 7. Teacher shares link
    ▼
[Shareable Link Generated]
    │
    │ http://localhost:3000/test/abc123...
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    STUDENT WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

[Student Browser]
    │
    │ 1. Open shareable link
    ▼
[Frontend: pages/test/[shareLink].tsx]
    │
    │ 2. GET /api/test/[shareLink]
    ▼
[Backend: pages/api/test/[shareLink].ts]
    │
    │ 3. Query database
    ▼
[lib/db.ts + Prisma]
    │ - Find test by shareLink
    │ - Get all questions
    │
    │ 4. Return test data
    ▼
[Frontend: pages/test/[shareLink].tsx]
    │ - Display questions
    │ - Show radio buttons
    │
    │ 5. Student answers questions
    ▼
[Frontend: pages/test/[shareLink].tsx]
    │ - Track answers in state
    │ - Update progress bar
    │
    │ 6. Submit test
    ▼
[Frontend: pages/test/[shareLink].tsx]
    │
    │ 7. POST /api/submit/[shareLink]
    │    Body: { answers: {...} }
    ▼
[Backend: pages/api/submit/[shareLink].ts]
    │
    │ 8. Calculate results
    │ - Compare answers
    │ - Calculate score
    │
    │ 9. Return results
    ▼
[Frontend: pages/test/[shareLink].tsx]
    │ - Display score
    │ - Show correct/incorrect
    │ - Highlight answers
    ▼
[Results Displayed]
```

---

## 📝 Step-by-Step Code Flow

### Step 1: File Upload

**File:** `pages/index.tsx`

```typescript
// User selects file
handleFileSelect(file)
  → validateFile(file)
  → setFile(file)  // Update state
  → UI shows file name
```

### Step 2: Submit Upload

**File:** `pages/index.tsx`

```typescript
handleSubmit()
  → Create FormData
  → fetch('/api/upload', { method: 'POST', body: formData })
  → Show progress bar
  → Wait for response
```

### Step 3: Backend Receives Upload

**File:** `pages/api/upload.ts`

```typescript
handler(req, res)
  → parseFormData(req)  // Extract file
  → extractTextFromFile(file)  // Get text
  → parseQuestionsFromText(text)  // AI processing
  → validateQuestions(questions)
  → generateShareLink()
  → prisma.test.create()  // Save to DB
  → return { shareLink, shareableUrl, ... }
```

### Step 4: Load Test

**File:** `pages/test/[shareLink].tsx`

```typescript
useEffect(() => {
  fetchTest(shareLink)
    → fetch(`/api/test/${shareLink}`)
    → setTest(data)
    → Render questions
})
```

### Step 5: Backend Returns Test

**File:** `pages/api/test/[shareLink].ts`

```typescript
handler(req, res)
  → prisma.test.findUnique({ where: { shareLink } })
  → Parse JSON options to arrays
  → return { test, questions }
```

### Step 6: Student Answers

**File:** `pages/test/[shareLink].tsx`

```typescript
handleAnswerChange(questionId, optionIndex)
  → setAnswers({ ...answers, [questionId]: optionIndex })
  → Update progress bar
  → Highlight selected option
```

### Step 7: Submit Answers

**File:** `pages/test/[shareLink].tsx`

```typescript
handleSubmit()
  → fetch(`/api/submit/${shareLink}`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    })
  → Wait for response
```

### Step 8: Calculate Results

**File:** `pages/api/submit/[shareLink].ts`

```typescript
handler(req, res)
  → Get test from database
  → For each question:
      - Compare user answer with correct answer
      - Mark as correct/incorrect
  → Calculate score: (correct / total) * 100
  → return { results, score, correctCount, totalCount }
```

### Step 9: Display Results

**File:** `pages/test/[shareLink].tsx`

```typescript
setResults(data)
  → setSubmitted(true)
  → Render results view:
      - Score circle
      - Question-by-question breakdown
      - Highlight correct/incorrect answers
```

---

## 🗂️ Data Structures

### Upload Request
```typescript
FormData {
  file: File  // TXT, DOCX, or PDF
}
```

### Upload Response
```typescript
{
  success: true,
  testId: "uuid",
  shareLink: "abc123...",
  shareableUrl: "http://localhost:3000/test/abc123...",
  questionCount: 5
}
```

### Test Data (Stored in DB)
```typescript
Test {
  id: "uuid",
  title: "Test Title",
  shareLink: "abc123...",
  questions: [
    {
      id: "q1",
      questionText: "What is 2+2?",
      options: '["3","4","5","6"]',  // JSON string
      correctOptionIndex: 1,
      order: 0
    }
  ]
}
```

### Submit Request
```typescript
{
  answers: {
    "questionId1": "0",  // Option index as string
    "questionId2": "2"
  }
}
```

### Submit Response
```typescript
{
  results: [
    {
      questionId: "q1",
      questionText: "What is 2+2?",
      options: ["3", "4", "5", "6"],
      correctOptionIndex: 1,
      userAnswer: 0,
      isCorrect: false
    }
  ],
  score: 50.0,
  correctCount: 1,
  totalCount: 2
}
```

---

## 🔑 Key Functions

### Frontend Functions

| Function | File | Purpose |
|----------|------|---------|
| `handleFileSelect()` | `pages/index.tsx` | Validate and set selected file |
| `handleSubmit()` | `pages/index.tsx` | Upload file to backend |
| `fetchTest()` | `pages/test/[shareLink].tsx` | Load test data |
| `handleAnswerChange()` | `pages/test/[shareLink].tsx` | Track user answers |
| `handleSubmit()` | `pages/test/[shareLink].tsx` | Submit test answers |

### Backend Functions

| Function | File | Purpose |
|----------|------|---------|
| `handler()` | `pages/api/upload.ts` | Process file upload |
| `extractTextFromFile()` | `lib/fileParser.ts` | Extract text from file |
| `parseQuestionsFromText()` | `lib/llmParser.ts` | AI parsing of questions |
| `handler()` | `pages/api/test/[shareLink].ts` | Get test data |
| `handler()` | `pages/api/submit/[shareLink].ts` | Calculate results |

---

## 🎬 Real Example Flow

### Example: Teacher uploads a test

1. **Teacher uploads file:**
   ```
   File: math-test.txt
   Content:
   "Question 1: What is 2+2?
   A) 3
   B) 4
   C) 5
   D) 6
   Answer: B"
   ```

2. **Backend processes:**
   ```
   Text extracted: "Question 1: What is 2+2? A) 3 B) 4..."
   ↓
   AI returns:
   {
     "questions": [{
       "questionText": "What is 2+2?",
       "options": ["3", "4", "5", "6"],
       "correctOptionIndex": 1
     }]
   }
   ↓
   Saved to database with shareLink: "abc123def456"
   ```

3. **Teacher gets link:**
   ```
   http://localhost:3000/test/abc123def456
   ```

4. **Student opens link:**
   ```
   GET /api/test/abc123def456
   ↓
   Returns: { questions: [...] }
   ↓
   UI shows question with radio buttons
   ```

5. **Student answers:**
   ```
   Selects option "A" (index 0)
   ↓
   Answers state: { "q1": "0" }
   ```

6. **Student submits:**
   ```
   POST /api/submit/abc123def456
   Body: { answers: { "q1": "0" } }
   ↓
   Backend compares: userAnswer (0) vs correctAnswer (1)
   ↓
   Result: isCorrect = false
   ```

7. **Results displayed:**
   ```
   Score: 0%
   Question 1: ✗ Incorrect
   - Option A (3): ✗ Your Answer
   - Option B (4): ✓ Correct Answer
   ```

---

This is the complete flow! Every step from upload to results. 🚀










