#!/bin/bash

# Phase 1 - Step 2: Run Database Migration
# This script applies the new database schema

echo "🔄 Running database migration..."
echo ""

# Run migration
npx prisma migrate dev --name add_user_authentication

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next step: Run the seed script to create test data"
echo "Command: npm run seed"



