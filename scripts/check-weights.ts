import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const all = await prisma.release.findMany({
    select: { releaseNumber: true, status: true, weight: true, pallets: true, freightTerms: true },
    orderBy: { createdAt: 'desc' },
  })
  console.log('Unshipped (where it matters):')
  all
    .filter((r) => r.status !== 'SHIPPED')
    .forEach((r) =>
      console.log(`  ${r.releaseNumber}  weight=${r.weight}  pallets=${r.pallets}  freightTerms=${r.freightTerms}`),
    )
  await prisma.$disconnect()
}
main()
