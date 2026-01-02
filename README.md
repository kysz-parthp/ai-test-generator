# AI Test Generator

An AI-powered web application that automatically converts teacher-uploaded text documents into interactive multiple-choice tests.

## Features

- 📄 **Multi-format Support**: Upload TXT, DOCX, or PDF files
- 🤖 **AI-Powered Parsing**: Automatically extracts questions, options, and correct answers using GPT-4
- 🔗 **Shareable Links**: Generate unique links for each test
- ✅ **Instant Results**: Students see correct/incorrect answers and scores immediately
- 🎨 **Modern UI**: Clean, responsive interface built with Next.js and TypeScript
- 🖱️ **Drag & Drop**: Intuitive file upload with drag-and-drop support
- 📊 **Progress Tracking**: Real-time progress indicators and answer completion tracking
- 🔔 **Toast Notifications**: Non-intrusive notifications for user feedback
- ⚡ **Smooth Animations**: Polished animations and transitions throughout
- 📱 **Fully Responsive**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI GPT-4 Turbo
- **File Parsing**: pdf-parse, mammoth

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public"
OPENAI_API_KEY="your-openai-api-key-here"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

**Important**: You need an OpenAI API key. Get one from [OpenAI Platform](https://platform.openai.com/api-keys).

### 3. Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Create database and tables
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### For Teachers

1. Go to the home page
2. Upload a document (TXT, DOCX, or PDF) containing questions
3. The AI will automatically extract questions, options, and correct answers
4. Copy the shareable link and send it to students

### Document Format

Your document should contain questions in natural language. See `example-test.txt` for a sample format. Examples:

```
Question 1: What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid
Correct Answer: C

Question 2: Which planet is closest to the Sun?
1. Venus
2. Mercury
3. Earth
4. Mars
Answer: 2
```

The AI is flexible and can handle various formats. It will extract:
- Question text
- Multiple answer options
- The correct answer (marked as "Correct:", "Answer:", "Key:", etc.)

### For Students

1. Open the shareable test link
2. Answer questions using radio buttons
3. Click "Submit Test"
4. View results immediately with:
   - Overall score percentage
   - Correct/incorrect status for each question
   - Highlighted correct answers
   - Your selected answers

## Project Structure

```
├── pages/
│   ├── api/
│   │   ├── upload.ts              # File upload endpoint
│   │   ├── test/[shareLink].ts    # Get test by share link
│   │   └── submit/[shareLink].ts  # Submit test answers
│   ├── index.tsx                  # Home/upload page
│   └── test/[shareLink].tsx       # Test taking page
├── lib/
│   ├── db.ts                      # Prisma client
│   ├── fileParser.ts              # File text extraction
│   ├── llmParser.ts               # AI question parsing
│   └── utils.ts                   # Utility functions
├── prisma/
│   └── schema.prisma              # Database schema
└── styles/
    └── globals.css                # Global styles
```

## API Endpoints

### POST `/api/upload`
Upload a document and generate a test.

**Request**: Multipart form data with `file` field

**Response**:
```json
{
  "success": true,
  "testId": "uuid",
  "shareLink": "abc123...",
  "shareableUrl": "http://localhost:3000/test/abc123...",
  "questionCount": 5
}
```

### GET `/api/test/[shareLink]`
Get test details by share link.

**Response**:
```json
{
  "id": "uuid",
  "title": "Test Title",
  "shareLink": "abc123...",
  "questions": [...]
}
```

### POST `/api/submit/[shareLink]`
Submit test answers.

**Request**:
```json
{
  "answers": {
    "questionId1": "0",
    "questionId2": "2"
  }
}
```

**Response**:
```json
{
  "results": [...],
  "score": 80.0,
  "correctCount": 4,
  "totalCount": 5
}
```

## Development

### Database Commands

```bash
# Generate Prisma Client
npm run db:generate

# Push schema changes to database
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Build for Production

```bash
npm run build
npm start
```

## Notes

- The application uses GPT-4 Turbo for question parsing, which requires an OpenAI API key
- File uploads are processed in memory (suitable for files up to ~10MB)
- The database uses PostgreSQL for production-ready scalability
- Share links are UUID-based and unique

## License

MIT

