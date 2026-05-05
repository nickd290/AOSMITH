import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📦 Adding historical releases and updating inventory...\n')

  // 1. Get or create the El Paso/Juarez shipping location
  const juarezLocation = await prisma.shippingLocation.upsert({
    where: { name: 'AO Smith - El Paso/Juarez' },
    update: {},
    create: {
      name: 'AO Smith - El Paso/Juarez',
      address: '7032 Doniphan Dr',
      city: 'El Paso',
      state: 'TX',
      zip: '79932',
      instructions: 'HEAT TREATED PALLETS',
      isActive: true,
    },
  })
  console.log('✅ El Paso/Juarez location:', juarezLocation.id)

  // Get Ashland City location
  const ashlandCity = await prisma.shippingLocation.findFirst({
    where: { name: { contains: 'Ashland City' } },
  })
  if (!ashlandCity) {
    throw new Error('Ashland City shipping location not found!')
  }
  console.log('✅ Ashland City location:', ashlandCity.id)

  // 2. Get parts
  const part7705 = await prisma.part.findUnique({ where: { partNumber: '100307705' } })
  const part9797 = await prisma.part.findUnique({ where: { partNumber: '100309797' } })

  if (!part7705 || !part9797) {
    throw new Error('Parts not found!')
  }
  console.log('✅ Parts found:', part7705.partNumber, part9797.partNumber)

  // 3. Get admin user (for userId)
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!admin) {
    throw new Error('Admin user not found!')
  }

  // 4. These batches shipped with the OLD pallet config (68 boxes/pallet, 130 units/box)
  // Shipped around Dec 8-9, 2025 via FedEx Freight from Three Z
  const shipDate = new Date('2025-12-09T00:00:00Z')

  // BATCH 3448 - TO EL PASO/JUAREZ
  // 8,840 of 100307705 = 1 pallet @ 68 boxes/pallet (8,840 / 130 = 68 boxes)
  // 17,680 of 100309797 = 2 pallets @ 68 boxes/pallet (17,680 / 130 = 136 boxes)
  const releases = [
    {
      releaseNumber: 'REL-20251209-H001',
      partId: part7705.id,
      shippingLocationId: juarezLocation.id,
      pallets: 1,
      boxes: 0,
      totalUnits: 8840,
      userId: admin.id,
      customerPONumber: '3448',
      ticketNumber: 'TKT-H001',
      batchNumber: '3448',
      shipVia: 'FedEx Freight',
      freightTerms: 'Collect',
      paymentTerms: '2% 30, Net 60',
      shipDate,
      etaDeliveryDate: new Date('2025-12-16T00:00:00Z'),
      cartons: 68,
      weight: 0,
      shippingClass: '55',
      notes: 'Historical release - shipped before dashboard was live. Old pallet config (68 boxes/pallet).',
      status: 'SHIPPED' as const,
    },
    {
      releaseNumber: 'REL-20251209-H002',
      partId: part9797.id,
      shippingLocationId: juarezLocation.id,
      pallets: 2,
      boxes: 0,
      totalUnits: 17680,
      userId: admin.id,
      customerPONumber: '3448',
      ticketNumber: 'TKT-H002',
      batchNumber: '3448',
      shipVia: 'FedEx Freight',
      freightTerms: 'Collect',
      paymentTerms: '2% 30, Net 60',
      shipDate,
      etaDeliveryDate: new Date('2025-12-16T00:00:00Z'),
      cartons: 136,
      weight: 0,
      shippingClass: '55',
      notes: 'Historical release - shipped before dashboard was live. Old pallet config (68 boxes/pallet).',
      status: 'SHIPPED' as const,
    },
    // BATCH 3449 - TO ASHLAND CITY
    // 53,040 of 100307705 = 6 pallets @ 68 boxes/pallet (53,040 / 130 = 408 boxes)
    // 70,720 of 100309797 = 8 pallets @ 68 boxes/pallet (70,720 / 130 = 544 boxes)
    {
      releaseNumber: 'REL-20251209-H003',
      partId: part7705.id,
      shippingLocationId: ashlandCity.id,
      pallets: 6,
      boxes: 0,
      totalUnits: 53040,
      userId: admin.id,
      customerPONumber: '3449',
      ticketNumber: 'TKT-H003',
      batchNumber: '3449',
      shipVia: 'FedEx Freight',
      freightTerms: 'Collect',
      paymentTerms: '2% 30, Net 60',
      shipDate,
      etaDeliveryDate: new Date('2025-12-16T00:00:00Z'),
      cartons: 408,
      weight: 0,
      shippingClass: '55',
      notes: 'Historical release - shipped before dashboard was live. Old pallet config (68 boxes/pallet).',
      status: 'SHIPPED' as const,
    },
    {
      releaseNumber: 'REL-20251209-H004',
      partId: part9797.id,
      shippingLocationId: ashlandCity.id,
      pallets: 8,
      boxes: 0,
      totalUnits: 70720,
      userId: admin.id,
      customerPONumber: '3449',
      ticketNumber: 'TKT-H004',
      batchNumber: '3449',
      shipVia: 'FedEx Freight',
      freightTerms: 'Collect',
      paymentTerms: '2% 30, Net 60',
      shipDate,
      etaDeliveryDate: new Date('2025-12-16T00:00:00Z'),
      cartons: 544,
      weight: 0,
      shippingClass: '55',
      notes: 'Historical release - shipped before dashboard was live. Old pallet config (68 boxes/pallet).',
      status: 'SHIPPED' as const,
    },
  ]

  for (const release of releases) {
    // Check if already exists (idempotent)
    const existing = await prisma.release.findUnique({
      where: { releaseNumber: release.releaseNumber },
    })
    if (existing) {
      console.log(`⏭️  Release ${release.releaseNumber} already exists, skipping`)
      continue
    }

    await prisma.release.create({ data: release })
    console.log(`✅ Created release ${release.releaseNumber}: ${release.totalUnits.toLocaleString()} units of ${release.partId === part7705.id ? '100307705' : '100309797'}`)
  }

  // 5. Update current inventory to correct totals
  // 240,000 of 100307705 → 36 pallets, 10 boxes = (36*51+10)*130 = 239,980 ≈ 240,000
  // 232,000 of 100309797 → 35 pallets, 0 boxes = (35*51)*130 = 232,050 ≈ 232,000
  await prisma.part.update({
    where: { partNumber: '100307705' },
    data: {
      currentPallets: 36,
      currentBoxes: 10,
    },
  })
  const total7705 = (36 * 51 + 10) * 130
  console.log(`\n✅ Updated 100307705 inventory: 36 pallets, 10 boxes = ${total7705.toLocaleString()} units`)

  await prisma.part.update({
    where: { partNumber: '100309797' },
    data: {
      currentPallets: 35,
      currentBoxes: 0,
    },
  })
  const total9797 = (35 * 51 + 0) * 130
  console.log(`✅ Updated 100309797 inventory: 35 pallets, 0 boxes = ${total9797.toLocaleString()} units`)

  console.log('\n🎉 Done! Historical releases added and inventory updated.')
  console.log(`   100307705 (36pg Gas): ${total7705.toLocaleString()} units on hand`)
  console.log(`   100309797 (28pg Elec): ${total9797.toLocaleString()} units on hand`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
