import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Updating part 100307705 boxes per pallet...')

  // First, let's see current state
  const before = await prisma.part.findUnique({
    where: { partNumber: '100307705' },
  })

  if (!before) {
    console.error('❌ Part 100307705 not found!')
    return
  }

  console.log('\n📦 BEFORE update:')
  console.log(`   Part: ${before.partNumber}`)
  console.log(`   Description: ${before.description}`)
  console.log(`   Units per box: ${before.unitsPerBox}`)
  console.log(`   Boxes per pallet: ${before.boxesPerPallet}`)
  console.log(`   Units per pallet: ${before.unitsPerBox * before.boxesPerPallet}`)

  // Update to new value: 51 boxes per pallet (3 layers high per new height requirement)
  const updated = await prisma.part.update({
    where: { partNumber: '100307705' },
    data: {
      boxesPerPallet: 51,
    },
  })

  console.log('\n✅ AFTER update:')
  console.log(`   Part: ${updated.partNumber}`)
  console.log(`   Description: ${updated.description}`)
  console.log(`   Units per box: ${updated.unitsPerBox}`)
  console.log(`   Boxes per pallet: ${updated.boxesPerPallet}`)
  console.log(`   Units per pallet: ${updated.unitsPerBox * updated.boxesPerPallet}`)

  console.log('\n🎉 Update complete!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
