# Connect to PostgreSQL Database

## Step 1: Create .env File

Create a `.env` file in the project root with this content:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public"
OPENAI_API_KEY="your-openai-api-key-here"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

**Important:** Replace `your-openai-api-key-here` with your actual OpenAI API key.

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Generate Prisma Client

```bash
npm run db:generate
```

## Step 4: Create Tables in Database

```bash
npm run db:push
```

This will create the `Test` and `Question` tables in your `ai_test_generator` database.

## Step 5: Verify Connection

```bash
npm run db:studio
```

This opens Prisma Studio where you can view your database tables.

## Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]?schema=public
```

For your setup:
- Username: `postgres`
- Password: `root`
- Host: `localhost` (or your PostgreSQL host)
- Port: `5432` (default PostgreSQL port)
- Database: `ai_test_generator`

## Troubleshooting

### If connection fails:
1. Verify PostgreSQL is running
2. Check username/password are correct
3. Verify database `ai_test_generator` exists in DBeaver
4. Check if PostgreSQL is listening on port 5432

### If tables don't create:
- Make sure you're connected to the correct database
- Check Prisma logs for errors
- Verify the connection string in `.env`








