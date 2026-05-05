/**
 * One-shot: switch every unshipped release's freightTerms to 'Prepaid'.
 * Apr 2026 EPG process: JD pays freight on its own XPO account, so all
 * outbound paperwork from this app is Prepaid.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const before = await prisma.release.findMany({
    where: { status: { not: 'SHIPPED' } },
    select: { releaseNumber: true, freightTerms: true, status: true },
  })
  console.log('Unshipped releases (before):')
  before.forEach((r) =>
    console.log(`  ${r.releaseNumber} [${r.status}]  freightTerms=${r.freightTerms}`),
  )

  const result = await prisma.release.updateMany({
    where: { status: { not: 'SHIPPED' } },
    data: { freightTerms: 'Prepaid' },
  })
  console.log(`\nUpdated ${result.count} unshipped release(s) to freightTerms='Prepaid'.`)
  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
