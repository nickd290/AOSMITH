import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10)
  const customerPassword = await bcrypt.hash('customer123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@jdgraphic.com' },
    update: {},
    create: {
      email: 'admin@jdgraphic.com',
      password: adminPassword,
      name: 'JD Graphic Admin',
      role: 'ADMIN',
    },
  })

  const customer = await prisma.user.upsert({
    where: { email: 'kirk@eprintgroup.com' },
    update: {},
    create: {
      email: 'kirk@eprintgroup.com',
      password: customerPassword,
      name: 'Kirk Icuss (ePrint Group)',
      role: 'CUSTOMER',
    },
  })

  console.log('✅ Users created:', { admin: admin.email, customer: customer.email })

  // Create part numbers with cost basis and vendor info
  const part1 = await prisma.part.upsert({
    where: { partNumber: '100307705' },
    update: {
      costBasisPerUnit: 0.2417,  // Buy cost from ThreeZ
      vendorName: 'ThreeZ',      // Vendor supplies paper
      description: 'MANUAL, 36 PAGE, RES, GAS, UNBRANDED',
      unitsPerBox: 130,          // Updated 2025-01-20
      boxesPerPallet: 51,        // Updated 2025-01-20: 3 layers high per new height requirement
    },
    create: {
      partNumber: '100307705',
      description: 'MANUAL, 36 PAGE, RES, GAS, UNBRANDED',
      unitsPerBox: 130,          // Updated 2025-01-20 (was 120)
      boxesPerPallet: 51,        // 3 layers high per new height requirement (was 68)
      pricePerUnit: 0.2859,       // Sell price to customer
      costBasisPerUnit: 0.2417,   // Buy cost from ThreeZ
      vendorName: 'ThreeZ',       // Vendor supplies paper
      annualOrder: 100000,
      currentPallets: 50, // Starting inventory
      currentBoxes: 10,
    },
  })

  const part2 = await prisma.part.upsert({
    where: { partNumber: '100309797' },
    update: {
      costBasisPerUnit: 0.1956,  // Buy cost from ThreeZ
      vendorName: 'ThreeZ',      // Vendor supplies paper
      description: 'MANUAL, 28 PAGE, RES, ELECT, UNBRANDED',
      unitsPerBox: 130,          // Updated 2025-01-20
      boxesPerPallet: 51,        // Updated 2025-01-20: 3 layers high per new height requirement
    },
    create: {
      partNumber: '100309797',
      description: 'MANUAL, 28 PAGE, RES, ELECT, UNBRANDED',
      unitsPerBox: 130,
      boxesPerPallet: 51,        // 3 layers high per new height requirement (was 68)
      pricePerUnit: 0.2225,       // Sell price to customer
      costBasisPerUnit: 0.1956,   // Buy cost from ThreeZ
      vendorName: 'ThreeZ',       // Vendor supplies paper
      annualOrder: 200000,
      currentPallets: 75, // Starting inventory
      currentBoxes: 5,
    },
  })

  console.log('✅ Parts created:', part1.partNumber, part2.partNumber)

  // Create shipping locations (AO Smith facilities)
  const locations = [
    {
      name: 'AO Smith - Ashland City, TN',
      address: '500 Tennessee Blvd',
      city: 'Ashland City',
      state: 'TN',
      zip: '37015',
    },
    {
      name: 'AO Smith - Johnson City, TN',
      address: '1802 E Oakland Ave',
      city: 'Johnson City',
      state: 'TN',
      zip: '37601',
    },
    {
      name: 'AO Smith - McBee, SC',
      address: '105 Industrial Park Rd',
      city: 'McBee',
      state: 'SC',
      zip: '29101',
    },
    {
      name: 'AO Smith - Stratford, ON',
      address: '275 Ontario St',
      city: 'Stratford',
      state: 'ON',
      zip: 'N5A 3H5',
    },
  ]

  for (const location of locations) {
    await prisma.shippingLocation.upsert({
      where: { name: location.name },
      update: {},
      create: location,
    })
  }

  console.log('✅ Shipping locations created:', locations.length)

  console.log('🎉 Seeding completed successfully!')
  console.log('\n📝 Login credentials:')
  console.log('   Customer: kirk@eprintgroup.com / customer123')
  console.log('   Admin: admin@jdgraphic.com / admin123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
