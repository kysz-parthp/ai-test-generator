import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')
  
  // For now, just a simple seed
  // We'll add bcrypt and create users in the next step
  
  console.log('✅ Seed complete!')
  console.log('')
  console.log('Next: Install auth dependencies')
  console.log('Command: npm install bcryptjs')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

