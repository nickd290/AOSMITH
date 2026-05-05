/**
 * Enrich the 6 new EPG inventory-release jobs on press-planner with:
 *   - totalPages (28 or 36 from part description)
 *   - finishedWidth: 8.5, finishedHeight: 11
 *   - paperWeight: 60, paperType: text, paperFinish: uncoated
 *   - name rewritten with REL-ID first so it's visible when truncated
 *
 * Usage:
 *   railway run -- npx tsx scripts/enrich-epg-press-planner.ts [--submit]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PP_URL = process.env.PRESS_PLANNER_URL || 'https://jd-press-planner-production.up.railway.app'

const TARGETS = [
  'REL-20260402-0027',
  'REL-20260402-0028',
  'REL-20260410-0029',
  'REL-20260415-0030',
  'REL-20260415-0031',
  'REL-20260420-0032',
]

function args() {
  return { submit: process.argv.includes('--submit') }
}

function parsePages(desc: string): number {
  const m = desc.match(/(\d+)\s*PAGE/i)
  return m ? parseInt(m[1], 10) : 0
}

function shortFlavor(desc: string): string {
  if (/ELECT/i.test(desc)) return 'RES/ELECT UNBRANDED'
  if (/GAS/i.test(desc)) return 'RES/GAS UNBRANDED'
  return desc.split(',').slice(1).join(',').trim().toUpperCase()
}

async function main() {
  const { submit } = args()
  console.log(`Mode: ${submit ? 'SUBMIT (PUT will fire)' : 'DRY-RUN'}`)

  const releases = await prisma.release.findMany({
    where: { releaseNumber: { in: TARGETS } },
    include: { part: true },
    orderBy: { releaseNumber: 'asc' },
  })

  const jobsRes = await fetch(`${PP_URL}/api/jobs?limit=200`)
  const jobsData = await jobsRes.json()
  const allJobs: any[] = jobsData.jobs || jobsData || []

  for (const release of releases) {
    const job = allJobs.find(
      (j) =>
        (j.productionNotes || '').includes(release.releaseNumber) &&
        (j.customerCode || '') === '2686',
    )
    if (!job) {
      console.log(`  ${release.releaseNumber}: NOT FOUND on press-planner — skipping`)
      continue
    }

    const pages = parsePages(release.part.description)
    const flavor = shortFlavor(release.part.description)
    // Include the Pricing Rules trigger phrase so jd-invoicing auto-computes productionCost
    // Rules: "AO Smith #100309797 Electric Water Heater Manual 28pg" → $0.225/pc
    //        "AO Smith #100307705 Gas Water Heater Manual 36pg"      → $0.2859/pc
    const pricingPhrase = release.part.partNumber === '100307705'
      ? `AO Smith #100307705 Gas Water Heater Manual 36pg`
      : `AO Smith #100309797 Electric Water Heater Manual 28pg`
    const newName = `${release.releaseNumber} | ${pricingPhrase} ${flavor} | 8.5x11 60# UNC TEXT`

    const updates = {
      name: newName,
      totalPages: pages,
      finishedWidth: 8.5,
      finishedHeight: 11,
      paperWeight: 60,
      paperType: 'text',
      paperFinish: 'uncoated',
      bookBinding: 'saddle-stitch',
    }

    console.log(`\n${release.releaseNumber} → ${job.jobNumber} (id=${job.id})`)
    console.log(`  new name: ${newName}`)
    console.log(`  pages:${pages}  size:8.5x11  paper:60# UNCOATED TEXT`)

    if (!submit) continue

    try {
      const r = await fetch(`${PP_URL}/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(15000),
      })
      const text = await r.text()
      console.log(`  PUT → ${r.status}${r.ok ? ' OK' : `: ${text.slice(0, 200)}`}`)
    } catch (e) {
      console.log(`  PUT → ERROR: ${e instanceof Error ? e.message : e}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
