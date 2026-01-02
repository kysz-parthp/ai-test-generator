# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public"
OPENAI_API_KEY="sk-your-key-here"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

**Get your OpenAI API key**: https://platform.openai.com/api-keys

## 3. Initialize Database

```bash
npm run db:generate
npm run db:push
```

## 4. Start Development Server

```bash
npm run dev
```

## 5. Test It Out

1. Open http://localhost:3000
2. Upload the `example-test.txt` file
3. Wait for processing (may take 10-30 seconds)
4. Copy the shareable link
5. Open the link in a new tab to take the test

## Troubleshooting

### "OPENAI_API_KEY is not set"
- Make sure your `.env` file exists and contains a valid OpenAI API key

### "Failed to process file"
- Check that your file is TXT, DOCX, or PDF format
- Ensure the file contains questions with clear answer options
- Try the example file first to verify setup

### Database errors
- Run `npm run db:push` to recreate the database
- Check that `DATABASE_URL` in `.env` points to a valid path

### Port already in use
- Change the port: `npm run dev -- -p 3001`

