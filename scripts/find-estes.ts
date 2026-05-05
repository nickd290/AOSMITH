import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const all = await prisma.release.findMany({
    select: {
      releaseNumber: true,
      status: true,
      carrier: true,
      shipVia: true,
      freightTerms: true,
      carrierAccountNumber: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  console.log('All releases (carrier | shipVia | freightTerms):')
  all.forEach((r) =>
    console.log(
      `  ${r.releaseNumber} [${r.status}]  carrier=${r.carrier}  shipVia=${r.shipVia}  freightTerms=${r.freightTerms}  acct=${r.carrierAccountNumber}`,
    ),
  )
  const issues = all.filter(
    (r) =>
      /estes/i.test(r.carrier ?? '') ||
      /estes/i.test(r.shipVia ?? '') ||
      /collect/i.test(r.freightTerms ?? ''),
  )
  console.log(`\nReleases with Estes or Collect: ${issues.length}`)
  issues.forEach((r) => console.log(`  ${r.releaseNumber}`))
  await prisma.$disconnect()
}
main()
