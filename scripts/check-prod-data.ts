import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check part 100307705
  const part = await prisma.part.findUnique({
    where: { partNumber: '100307705' },
  })

  console.log('\n📦 Part 100307705:')
  if (part) {
    console.log('   unitsPerBox:', part.unitsPerBox)
    console.log('   boxesPerPallet:', part.boxesPerPallet)
    console.log('   Units per pallet:', part.unitsPerBox * part.boxesPerPallet)
  } else {
    console.log('   NOT FOUND!')
  }

  // Check all shipping locations
  const locations = await prisma.shippingLocation.findMany({
    orderBy: { name: 'asc' }
  })

  console.log('\n📍 Shipping Locations:')
  locations.forEach(loc => {
    console.log('  ', loc.id + ':', loc.name, '-', loc.city + ',', loc.state)
  })
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
