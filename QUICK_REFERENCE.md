# Quick Reference Card

## 📚 Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **PRODUCTION_ARCHITECTURE.md** | Complete system design | Understanding architecture |
| **IMPLEMENTATION_GUIDE.md** | Step-by-step coding guide | During development |
| **MIGRATION_CHECKLIST.md** | Project tracking | Managing the migration |
| **ARCHITECTURE_DIAGRAMS.md** | Visual reference | Understanding flows |
| **PRODUCTION_SUMMARY.md** | High-level overview | Quick understanding |
| **QUICK_REFERENCE.md** | This document | Quick lookups |

---

## 🚀 Quick Commands

### Development
```bash
# Start development server
npm run dev

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Open database GUI
npx prisma studio

# Run tests
npm test

# Build for production
npm run build
```

### Database
```bash
# Backup database
pg_dump -h localhost -U postgres ai_test_generator > backup.sql

# Restore database
psql -h localhost -U postgres ai_test_generator < backup.sql

# Reset database (DANGER!)
npx prisma migrate reset

# Seed database
npx ts-node prisma/seed.ts
```

---

## 🔑 Test Accounts (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@test.com | teacher123 |
| Student 1 | student1@test.com | student123 |
| Student 2 | student2@test.com | student123 |

---

## 📁 Key File Locations

### Configuration
```
.env                          # Environment variables
prisma/schema.prisma          # Database schema
next.config.js                # Next.js configuration
tsconfig.json                 # TypeScript configuration
```

### Authentication
```
lib/auth/auth.ts              # Auth functions
lib/auth/authMiddleware.ts    # Auth middleware
pages/api/auth/               # Auth endpoints
pages/auth/                   # Auth pages
```

### API Routes
```
pages/api/auth/               # Authentication
pages/api/teacher/            # Teacher endpoints
pages/api/student/            # Student endpoints
pages/api/upload.ts           # File upload
```

### Pages
```
pages/dashboard/teacher.tsx   # Teacher dashboard
pages/dashboard/student.tsx   # Student dashboard
pages/auth/login.tsx          # Login page
pages/auth/register.tsx       # Register page
```

### Components
```
components/Layout.tsx         # Main layout
components/RoleGuard.tsx      # Role protection
components/LoadingSpinner.tsx # Loading state
components/Toast.tsx          # Notifications
```

---

## 🎯 User Roles & Permissions

### Student
- ✅ Take assigned tests
- ✅ View own results
- ✅ Join classes
- ❌ Create tests
- ❌ View others' results

### Teacher
- ✅ Create tests
- ✅ Manage classes
- ✅ Assign tests
- ✅ View all student results
- ✅ Grade descriptive answers
- ❌ Access admin functions

### Admin (Future)
- ✅ All teacher permissions
- ✅ Manage users
- ✅ System configuration
- ✅ View all data

---

## 🔐 Environment Variables

### Required
```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
OPENAI_API_KEY="sk-..."
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### Optional
```bash
SESSION_SECRET="random-32-char-string"
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG...."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="bucket-name"
SENTRY_DSN="https://..."
```

---

## 🗄️ Database Models Quick Reference

### Core Models
```
User → TeacherProfile → Test → Question
User → StudentProfile → TestAttempt → Answer
Class → Enrollment (joins Student & Class)
Test → TestAssignment (assigns Test to Class)
```

### Key Fields
```typescript
User {
  email, passwordHash, role, status
}

Test {
  teacherId, status, visibility, shareLink
}

TestAttempt {
  testId, studentId, attemptNumber, score
}
```

---

## 🛣️ API Endpoints Quick Reference

### Authentication
```
POST   /api/auth/register     # Register user
POST   /api/auth/login        # Login
POST   /api/auth/logout       # Logout
GET    /api/auth/me           # Get current user
```

### Teacher
```
GET    /api/teacher/tests              # List tests
POST   /api/upload                     # Create test
GET    /api/teacher/tests/:id          # Get test
PUT    /api/teacher/tests/:id          # Update test
DELETE /api/teacher/tests/:id          # Delete test
POST   /api/teacher/tests/:id/assign   # Assign test
GET    /api/teacher/tests/:id/results  # View results
```

### Student
```
GET    /api/student/tests              # List assigned tests
GET    /api/student/tests/:id          # Get test
POST   /api/student/tests/:id/start    # Start attempt
POST   /api/student/tests/:id/submit   # Submit answers
GET    /api/student/results/:id        # View result
```

### Classes
```
GET    /api/teacher/classes            # List classes
POST   /api/teacher/classes            # Create class
POST   /api/student/classes/join       # Join class
```

---

## 🎨 UI Component Patterns

### Protected Route
```typescript
<RoleGuard allowedRoles={['TEACHER']}>
  <TeacherContent />
</RoleGuard>
```

### Conditional Render
```typescript
<ConditionalRender roles={['TEACHER', 'ADMIN']}>
  <AdminButton />
</ConditionalRender>
```

### Auth Check
```typescript
const { user, isAuthenticated } = useAuthStore()

if (!isAuthenticated) {
  return <LoginPrompt />
}
```

---

## 🔧 Common Code Snippets

### Protect API Endpoint
```typescript
import { requireTeacher } from '@/lib/auth/authMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // req.user is available
}

export default requireTeacher(handler)
```

### Check Resource Ownership
```typescript
const isOwner = await checkResourceOwnership(
  req.user.id,
  'test',
  testId
)

if (!isOwner) {
  return res.status(403).json({ error: 'Access denied' })
}
```

### Create Audit Log
```typescript
await prisma.auditLog.create({
  data: {
    userId: req.user.id,
    action: 'test.create',
    entityType: 'Test',
    entityId: test.id
  }
})
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"
1. Check PostgreSQL is running
2. Verify DATABASE_URL in .env
3. Check database exists
4. Test connection: `psql $DATABASE_URL`

### "Prisma Client not found"
```bash
npx prisma generate
```

### "Session not working"
1. Check cookie settings
2. Verify session token in database
3. Check session expiration
4. Clear browser cookies

### "Permission denied"
1. Check user role
2. Verify middleware is applied
3. Check resource ownership
4. Review audit logs

### "File upload failing"
1. Check file size (< 10MB)
2. Verify file type (PDF, DOCX, TXT)
3. Check uploads directory exists
4. Verify permissions

---

## 📊 Monitoring & Debugging

### Check Logs
```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# View Vercel logs
vercel logs
```

### Database Queries
```bash
# Open Prisma Studio
npx prisma studio

# Run SQL query
psql $DATABASE_URL -c "SELECT * FROM \"User\" LIMIT 5;"
```

### Performance
```bash
# Check bundle size
npm run build

# Analyze bundle
npm run analyze
```

---

## 🚦 Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Unexpected error |

---

## 📈 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Page Load | < 2s | - |
| API Response | < 500ms | - |
| Time to Interactive | < 3s | - |
| First Contentful Paint | < 1s | - |
| Lighthouse Score | > 90 | - |

---

## 🔒 Security Checklist

- [ ] HTTPS enabled
- [ ] Passwords hashed (bcrypt)
- [ ] Sessions expire
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] SQL injection prevention (Prisma)
- [ ] Rate limiting
- [ ] Input validation
- [ ] Output encoding
- [ ] Audit logging

---

## 📞 Emergency Contacts

### Production Issues
1. Check Vercel dashboard
2. Check Sentry for errors
3. Check database status
4. Review recent deployments
5. Check external services (OpenAI, S3)

### Rollback Procedure
```bash
# Revert deployment
vercel rollback

# Restore database
psql $DATABASE_URL < backup.sql

# Revert code
git revert HEAD
git push
```

---

## 🎓 Learning Resources

### Next.js
- [Official Docs](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

### Prisma
- [Docs](https://www.prisma.io/docs)
- [Quickstart](https://www.prisma.io/docs/getting-started)

### TypeScript
- [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### PostgreSQL
- [Docs](https://www.postgresql.org/docs/)
- [Tutorial](https://www.postgresqltutorial.com/)

---

## 💡 Pro Tips

1. **Always backup before migrations**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. **Use Prisma Studio for debugging**
   ```bash
   npx prisma studio
   ```

3. **Test in staging first**
   - Never deploy directly to production
   - Use preview deployments

4. **Monitor error rates**
   - Set up Sentry alerts
   - Check logs daily

5. **Keep dependencies updated**
   ```bash
   npm outdated
   npm update
   ```

6. **Use TypeScript strictly**
   - Enable strict mode
   - Fix type errors immediately

7. **Write tests for critical paths**
   - Authentication
   - Test submission
   - Grading logic

8. **Document as you go**
   - Update README
   - Comment complex logic
   - Keep API docs current

---

## 🎯 Next Steps

### This Week
1. ✅ Read PRODUCTION_ARCHITECTURE.md
2. ✅ Review IMPLEMENTATION_GUIDE.md
3. ⬜ Set up development environment
4. ⬜ Run seed script
5. ⬜ Test authentication flow

### This Month
1. ⬜ Implement Phase 1 (Foundation)
2. ⬜ Implement Phase 2 (Core Features)
3. ⬜ Test with real users
4. ⬜ Gather feedback
5. ⬜ Plan Phase 3

### This Quarter
1. ⬜ Complete all features
2. ⬜ Security audit
3. ⬜ Performance optimization
4. ⬜ Production deployment
5. ⬜ User onboarding

---

## 📝 Notes

- Keep this reference handy during development
- Update as you discover new patterns
- Share with team members
- Print for quick access

---

**Last Updated:** January 2026
**Version:** 1.0
**Status:** Production Ready Architecture

