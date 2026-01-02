# Quick Connection Test

## How to Verify Frontend-Backend Connection

### Step 1: Start the Application

```bash
# Install dependencies (if not done)
npm install

# Initialize database
npm run db:generate
npm run db:push

# Start development server
npm run dev
```

### Step 2: Test in Browser

1. **Open Browser Developer Tools**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Go to the **Network** tab

2. **Test Upload Endpoint**
   - Navigate to http://localhost:3000
   - Upload a file (use `example-test.txt`)
   - In Network tab, look for request to `/api/upload`
   - ✅ Should see status `200` and response with `shareLink`

3. **Test Get Test Endpoint**
   - Click on the shareable link or copy it
   - In Network tab, look for request to `/api/test/[shareLink]`
   - ✅ Should see status `200` and response with questions array

4. **Test Submit Endpoint**
   - Answer some questions
   - Click "Submit Test"
   - In Network tab, look for request to `/api/submit/[shareLink]`
   - ✅ Should see status `200` and response with results

### Step 3: Check Console for Errors

- Open **Console** tab in Developer Tools
- Look for any red error messages
- ✅ No errors = Connection is working!

## Expected Network Requests

When everything is connected, you should see:

```
1. POST /api/upload          → 200 OK
2. GET  /api/test/[shareLink] → 200 OK  
3. POST /api/submit/[shareLink] → 200 OK
```

## Troubleshooting

### If you see 404 errors:
- ✅ Check that files exist in `pages/api/` directory
- ✅ Verify file names match exactly

### If you see 500 errors:
- ✅ Check `.env` file has `OPENAI_API_KEY` set
- ✅ Verify database is initialized (`npm run db:push`)
- ✅ Check console for detailed error messages

### If file upload fails:
- ✅ Check file size is under 10MB
- ✅ Verify file is TXT, DOCX, or PDF format
- ✅ Check Network tab for error response

## Connection Status

✅ **All endpoints are properly connected!**

The frontend and backend communicate through:
- Next.js API Routes (same origin, no CORS needed)
- Standard HTTP requests (fetch API)
- JSON data format
- FormData for file uploads








