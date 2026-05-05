/**
 * One-time backfill: push existing releases to rmgt-scheduler + jd-invoicing.
 *
 * Usage:
 *   npx tsx scripts/backfill-integrations.ts                  # all releases, both targets
 *   npx tsx scripts/backfill-integrations.ts --only REL-A,REL-B   # only listed REL-IDs
 *   npx tsx scripts/backfill-integrations.ts --skip-rmgt      # push only to jd-invoicing
 *   npx tsx scripts/backfill-integrations.ts --only REL-A --skip-rmgt
 *
 * jd-invoicing has dedup built in, so safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RMGT_SCHEDULER_URL = process.env.RMGT_SCHEDULER_URL || 'https://rmgt-scheduler-production.up.railway.app'
const JD_INVOICING_URL = process.env.JD_INVOICING_URL || 'https://jd-invoice-production.up.railway.app'

function parseArgs() {
  const argv = process.argv.slice(2)
  let only: string[] | null = null
  let skipRmgt = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--only') {
      only = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    } else if (a.startsWith('--only=')) {
      only = a.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
    } else if (a === '--skip-rmgt') {
      skipRmgt = true
    }
  }
  return { only, skipRmgt }
}

async function backfill() {
  const { only, skipRmgt } = parseArgs()

  const where = only && only.length ? { releaseNumber: { in: only } } : undefined
  const releases = await prisma.release.findMany({
    where,
    include: {
      part: true,
      shippingLocation: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (only && only.length) {
    console.log(`Filter: --only ${only.join(',')} (${only.length} requested)`)
    const found = new Set(releases.map((r) => r.releaseNumber))
    const missing = only.filter((r) => !found.has(r))
    if (missing.length) {
      console.log(`WARN: not found in DB: ${missing.join(', ')}`)
    }
  }
  if (skipRmgt) console.log('Flag: --skip-rmgt (rmgt-scheduler push disabled)')
  console.log(`Found ${releases.length} releases to backfill\n`)

  for (const release of releases) {
    const shipDateStr = release.shipDate
      ? new Date(release.shipDate).toISOString().split('T')[0]
      : new Date(release.createdAt).toISOString().split('T')[0]

    const description = `${release.part.partNumber} — ${release.part.description} | ${release.releaseNumber}`
    const notes = `INVENTORY RELEASE | ${release.releaseNumber} | Ticket: ${release.ticketNumber ?? 'N/A'} | Batch: ${release.batchNumber ?? 'N/A'} | Ship to: ${release.shippingLocation.name} via ${release.shipVia || 'Averitt Collect'}`

    console.log(`--- ${release.releaseNumber} | ${release.part.partNumber} | ${release.totalUnits} units ---`)

    // 1. JD Invoicing (has dedup — safe to retry)
    try {
      // Check for existing first
      const searchRes = await fetch(
        `${JD_INVOICING_URL}/api/jobs?search=${encodeURIComponent(release.releaseNumber)}&client=epg`,
        { signal: AbortSignal.timeout(5000) }
      )
      const searchData = await searchRes.json()
      const jobs = searchData.jobs || searchData || []
      const existing = jobs.find((j: any) =>
        j.description?.includes(release.releaseNumber) || j.notes?.includes(release.releaseNumber)
      )

      if (existing) {
        console.log(`  [jd-invoicing] SKIP — already exists as ${existing.jobNumber}`)
      } else {
        const res = await fetch(`${JD_INVOICING_URL}/api/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: 'EPG Enterprise Print Group',
            description,
            quantity: String(release.totalUnits),
            poNumber: release.customerPONumber,
            dueDate: shipDateStr,
            pressType: 'digital-inkjet',
            jobType: 'inventory-release',
            notes,
          }),
          signal: AbortSignal.timeout(10000),
        })
        const data = await res.json()
        if (res.ok) {
          console.log(`  [jd-invoicing] CREATED — ${data.jobNumber}`)
        } else {
          console.log(`  [jd-invoicing] FAILED — ${res.status}: ${JSON.stringify(data)}`)
        }
      }
    } catch (err) {
      console.log(`  [jd-invoicing] ERROR — ${err instanceof Error ? err.message : err}`)
    }

    // 2. RMGT Scheduler
    if (skipRmgt) {
      console.log(`  [rmgt-scheduler] SKIP — --skip-rmgt`)
      console.log('')
      continue
    }
    try {
      const res = await fetch(`${RMGT_SCHEDULER_URL}/api/new-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: 'EPG Enterprise Print Group',
          customerCode: '2686',
          projectName: `${release.part.partNumber} — ${release.part.description}`,
          quantity: release.totalUnits,
          category: 'OTHER',
          product: 'inventory-release',
          equipment: 'screen-1',
          dueDate: shipDateStr,
          purchaseOrder: release.customerPONumber,
          productionNotes: `INVENTORY RELEASE | ${release.releaseNumber} | Ship to: ${release.shippingLocation.name}`,
          source: 'inventory-release',
          status: 'complete',
        }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      if (res.ok) {
        console.log(`  [rmgt-scheduler] CREATED — ${data.jobNumber}`)
      } else {
        console.log(`  [rmgt-scheduler] FAILED — ${res.status}: ${JSON.stringify(data)}`)
      }
    } catch (err) {
      console.log(`  [rmgt-scheduler] ERROR — ${err instanceof Error ? err.message : err}`)
    }

    console.log('')
  }

  console.log('Backfill complete.')
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
