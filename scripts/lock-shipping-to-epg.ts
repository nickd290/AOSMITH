/**
 * Lock all ShippingLocation rows so the only active destination is EPG Knoxville.
 *
 * Per Kirk Icuss Apr 24 2026 directive: "Do not ship anything direct to the AOS
 * Facilities. Please delete all AOS locations from your system. The only address
 * you will need is ours here at Enterprise Print Group."
 *
 * We don't delete (existing Release rows FK to AOS locations — deletion would
 * orphan history). We mark every existing row isActive=false and upsert one
 * active row for EPG Knoxville.
 *
 * Usage:
 *   # 1) Dry-run — prints what would change, makes NO writes
 *   railway run -- npx tsx scripts/lock-shipping-to-epg.ts
 *
 *   # 2) After Nick approves, mutate for real
 *   railway run -- npx tsx scripts/lock-shipping-to-epg.ts --submit
 */

import { PrismaClient } from '@prisma/client'
import { EPG_SHIP_TO } from '../lib/epg'

const prisma = new PrismaClient()

async function main() {
  const submit = process.argv.includes('--submit')
  const mode = submit ? 'SUBMIT' : 'DRY-RUN'

  console.log(`\n=== lock-shipping-to-epg.ts (${mode}) ===\n`)

  const existing = await prisma.shippingLocation.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  console.log(`Found ${existing.length} existing ShippingLocation row(s):`)
  for (const loc of existing) {
    const flag = loc.isActive ? 'ACTIVE  ' : 'inactive'
    console.log(`  [${flag}] ${loc.name} — ${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`)
  }

  const epgExisting = existing.find(
    (l) =>
      l.name === EPG_SHIP_TO.name ||
      (l.city.toLowerCase() === 'knoxville' && l.state.toUpperCase() === 'TN'),
  )

  console.log('\nPlanned actions:')
  const willDeactivate = existing.filter((l) => l.id !== epgExisting?.id && l.isActive)
  for (const loc of willDeactivate) {
    console.log(`  - DEACTIVATE  ${loc.name}`)
  }
  if (epgExisting) {
    console.log(`  - UPSERT (update) EPG Knoxville  (id=${epgExisting.id})`)
  } else {
    console.log(`  - UPSERT (create) ${EPG_SHIP_TO.name} @ ${EPG_SHIP_TO.address}, ${EPG_SHIP_TO.city} ${EPG_SHIP_TO.state}`)
  }

  if (!submit) {
    console.log('\n(Dry-run — no writes performed. Re-run with --submit to apply.)\n')
    return
  }

  console.log('\nApplying changes...')

  await prisma.$transaction(async (tx) => {
    if (willDeactivate.length > 0) {
      await tx.shippingLocation.updateMany({
        where: { id: { in: willDeactivate.map((l) => l.id) } },
        data: { isActive: false },
      })
      console.log(`  ✓ Deactivated ${willDeactivate.length} location(s)`)
    }

    const epgInstructions =
      'JD ships via FedEx Freight on JD account (manual phone booking). ' +
      'Apply AOS box labels from release attachment.'

    if (epgExisting) {
      await tx.shippingLocation.update({
        where: { id: epgExisting.id },
        data: {
          name: EPG_SHIP_TO.name,
          address: EPG_SHIP_TO.address,
          city: EPG_SHIP_TO.city,
          state: EPG_SHIP_TO.state,
          zip: EPG_SHIP_TO.zip,
          isActive: true,
          instructions: epgInstructions,
        },
      })
      console.log(`  ✓ Updated existing EPG Knoxville row (id=${epgExisting.id})`)
    } else {
      const created = await tx.shippingLocation.create({
        data: {
          name: EPG_SHIP_TO.name,
          address: EPG_SHIP_TO.address,
          city: EPG_SHIP_TO.city,
          state: EPG_SHIP_TO.state,
          zip: EPG_SHIP_TO.zip,
          isActive: true,
          instructions: epgInstructions,
        },
      })
      console.log(`  ✓ Created EPG Knoxville row (id=${created.id})`)
    }
  })

  const after = await prisma.shippingLocation.findMany({
    where: { isActive: true },
  })
  console.log(`\nFinal state: ${after.length} active location(s)`)
  for (const loc of after) {
    console.log(`  ✓ ${loc.name} — ${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`)
  }
  console.log('\nDone.\n')
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
