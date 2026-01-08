# Quick PostgreSQL Setup Guide

## ✅ Database Name Suggestion

**Recommended Database Name:** `ai_test_generator`

This name is:
- ✅ Descriptive and clear
- ✅ Follows naming conventions (lowercase, underscores)
- ✅ Easy to remember
- ✅ Professional

## 🚀 Quick Setup Steps

### Step 1: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE ai_test_generator;

# Exit PostgreSQL
\q
```

Or using command line:
```bash
createdb -U postgres ai_test_generator
```

### Step 2: Create `.env` File

Create a `.env` file in your project root:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public"
OPENAI_API_KEY="your-openai-api-key-here"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### Step 3: Install Dependencies

```bash
npm install
```

This will install the `pg` package for PostgreSQL support.

### Step 4: Initialize Database Schema

```bash
# Generate Prisma Client for PostgreSQL
npm run db:generate

# Create tables in PostgreSQL
npm run db:push
```

### Step 5: Verify Connection

```bash
# Open Prisma Studio to view your database
npm run db:studio
```

This opens a web interface where you can see your tables and data.

## 📋 Connection String Breakdown

```
postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public
│          │        │    │         │    │                │
│          │        │    │         │    │                └─ Schema name
│          │        │    │         │    └─ Database name
│          │        │    │         └─ Port (default: 5432)
│          │        │    └─ Host (localhost)
│          │        └─ Password
│          └─ Username
└─ Protocol
```

## ✅ Verification Checklist

- [ ] PostgreSQL is installed and running
- [ ] Database `ai_test_generator` is created
- [ ] `.env` file exists with correct `DATABASE_URL`
- [ ] Dependencies installed (`npm install`)
- [ ] Prisma Client generated (`npm run db:generate`)
- [ ] Tables created (`npm run db:push`)
- [ ] Can connect via Prisma Studio

## 🔧 Troubleshooting

### "Database does not exist"
```bash
createdb -U postgres ai_test_generator
```

### "Connection refused"
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### "Authentication failed"
- Double-check username and password in `.env`
- Verify PostgreSQL user permissions

### "Relation does not exist"
```bash
# Re-run database setup
npm run db:push
```

## 🎯 Next Steps

Once setup is complete:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test the application:
   - Upload a test file
   - Verify data is saved to PostgreSQL
   - Check Prisma Studio to see the data

3. Your database is ready! 🎉










