/**
 * One-off: create default ReleaseShipment rows for releases missing them.
 * Usage: DATABASE_URL=<prod> npx tsx scripts/backfill-release-shipments.ts
 */
import { PrismaClient } from '@prisma/client'
import { shipmentTotals } from '../lib/shipments/helpers'

const prisma = new PrismaClient()

async function main() {
  const releases = await prisma.release.findMany({
    include: { part: true, shipments: true },
  })

  let created = 0
  for (const release of releases) {
    if (release.shipments.length > 0) continue
    const totals = shipmentTotals(release.pallets, release.boxes, release.part)
    await prisma.releaseShipment.create({
      data: {
        releaseId: release.id,
        shipmentNumber: 1,
        pallets: release.pallets,
        boxes: release.boxes,
        totalUnits: totals.totalUnits,
        cartons: totals.cartons,
        weight: totals.weight,
        status: release.status === 'SHIPPED' ? 'SHIPPED' : 'PENDING',
        proNumber: release.proNumber,
        carrier: release.carrier,
        shippedAt: release.shippedAt,
        shipDate: release.shipDate,
      },
    })
    created++
    console.log(`✓ ${release.releaseNumber} → shipment 1 (${release.pallets} skids)`)
  }

  console.log(`Done. Created ${created} shipment(s) for ${releases.length} releases.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())