/**
 * One-shot: switch every NOT-yet-shipped release to XPO defaults.
 * Shipped releases keep their historical carrier value.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const before = await prisma.release.findMany({
    where: { status: { not: 'SHIPPED' } },
    select: { id: true, releaseNumber: true, status: true, carrier: true, shipVia: true },
  })
  console.log(`Found ${before.length} unshipped release(s):`)
  before.forEach((r) =>
    console.log(`  ${r.releaseNumber} [${r.status}] carrier=${r.carrier} shipVia=${r.shipVia}`),
  )

  const result = await prisma.release.updateMany({
    where: { status: { not: 'SHIPPED' } },
    data: {
      carrier: 'XPO',
      shipVia: 'XPO',
      carrierAccountNumber: 'JDGRCCTS900',
    },
  })
  console.log(`\nUpdated ${result.count} release(s) to XPO/JDGRCCTS900.`)
  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
