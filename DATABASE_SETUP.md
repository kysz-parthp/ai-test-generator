# PostgreSQL Database Setup

## Database Configuration

**Database Name:** `ai_test_generator`

**Connection Details:**
- Username: `postgres`
- Password: `root`
- Host: `localhost`
- Port: `5432` (default PostgreSQL port)
- Database: `ai_test_generator`

## Setup Instructions

### 1. Install PostgreSQL (if not already installed)

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL Official Website](https://www.postgresql.org/download/windows/)

### 2. Create Database

Connect to PostgreSQL and create the database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ai_test_generator;

# Verify creation
\l

# Exit
\q
```

Or using command line:
```bash
createdb -U postgres ai_test_generator
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public"
OPENAI_API_KEY="your-openai-api-key-here"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 4. Install PostgreSQL Client (if needed)

The Prisma client will handle PostgreSQL connections, but you may need the `pg` package:

```bash
npm install pg @types/pg
```

### 5. Initialize Database Schema

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push
```

Or use migrations (recommended for production):
```bash
# Create migration
npx prisma migrate dev --name init

# Apply migration
npx prisma migrate deploy
```

### 6. Verify Connection

```bash
# Open Prisma Studio to view database
npm run db:studio
```

This will open a web interface at http://localhost:5555 where you can view and manage your database.

## Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]?schema=[schema]
```

**Example:**
```
postgresql://postgres:root@localhost:5432/ai_test_generator?schema=public
```

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running: `pg_isready` or `brew services list`
- Check if PostgreSQL is listening on port 5432: `lsof -i :5432`

### Authentication Failed
- Verify username and password are correct
- Check PostgreSQL authentication settings in `pg_hba.conf`

### Database Does Not Exist
- Create the database: `createdb -U postgres ai_test_generator`
- Verify: `psql -U postgres -l`

### Permission Denied
- Ensure the `postgres` user has permission to create databases
- Try: `psql -U postgres -c "ALTER USER postgres WITH SUPERUSER;"`

## Production Considerations

For production, consider:

1. **Use Environment Variables:**
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public&sslmode=require"
   ```

2. **Connection Pooling:**
   - Prisma handles connection pooling automatically
   - Configure pool size in connection string if needed

3. **SSL/TLS:**
   - Add `?sslmode=require` for secure connections
   - Use connection pooling services like PgBouncer for high traffic

4. **Backup:**
   ```bash
   # Backup database
   pg_dump -U postgres ai_test_generator > backup.sql
   
   # Restore database
   psql -U postgres ai_test_generator < backup.sql
   ```

## Database Schema

The application uses two main tables:

1. **Test** - Stores test metadata
   - id (UUID)
   - title (String)
   - shareLink (String, unique)
   - createdAt (DateTime)

2. **Question** - Stores individual questions
   - id (UUID)
   - testId (UUID, foreign key)
   - questionText (String)
   - options (String, JSON)
   - correctOptionIndex (Int)
   - order (Int)
   - createdAt (DateTime)

## Useful Commands

```bash
# View database tables
psql -U postgres -d ai_test_generator -c "\dt"

# View table structure
psql -U postgres -d ai_test_generator -c "\d Test"
psql -U postgres -d ai_test_generator -c "\d Question"

# Count records
psql -U postgres -d ai_test_generator -c "SELECT COUNT(*) FROM \"Test\";"

# View all tests
psql -U postgres -d ai_test_generator -c "SELECT * FROM \"Test\";"
```








