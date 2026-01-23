#!/bin/bash
echo "🔄 Running database migration..."
npx prisma migrate dev --name add_user_authentication --create-only
npx prisma migrate deploy
echo "✅ Migration complete!"





