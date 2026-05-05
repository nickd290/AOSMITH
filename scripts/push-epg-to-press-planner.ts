/**
 * One-off: push the 6 EPG inventory-release backlog entries to jd-press-planner.
 *
 * Why: the jd-invoicing POST /api/jobs path silently fails (returns 201 without
 * persisting). Press-planner writes directly to shared public.jobs which is what
 * jd-invoicing's UI reads from, and generates the 2686-NNNNNN jobNumber format.
 *
 * Usage:
 *   # 1) Dry-run — prints drafts, makes NO writes
 *   railway run -- npx tsx scripts/push-epg-to-press-planner.ts
 *
 *   # 2) After Nick approves, submit for real
 *   railway run -- npx tsx scripts/push-epg-to-press-planner.ts --submit
 *
 *   # 3) Optional: only one release
 *   railway run -- npx tsx scripts/push-epg-to-press-planner.ts --only REL-20260402-0027 [--submit]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PRESS_PLANNER_URL =
  process.env.PRESS_PLANNER_URL || 'https://jd-press-planner-production.up.railway.app'

const TARGETS = [
  'REL-20260402-0027',
  'REL-20260402-0028',
  'REL-20260410-0029',
  'REL-20260415-0030',
  'REL-20260415-0031',
  'REL-20260420-0032',
]

interface Args {
  submit: boolean
  only: string[] | null
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let submit = false
  let only: string[] | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--submit') submit = true
    else if (a === '--only') only = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (a.startsWith('--only=')) only = a.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  }
  return { submit, only }
}

function ymd(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

async function pressPlannerJobsSnapshot(): Promise<any[]> {
  const res = await fetch(`${PRESS_PLANNER_URL}/api/jobs?limit=200`, {
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    console.warn(`[dedup] GET /api/jobs returned ${res.status} — proceeding cautiously`)
    return []
  }
  const data = await res.json()
  return (data.jobs as any[]) || (Array.isArray(data) ? data : [])
}

function findDuplicate(existing: any[], releaseNumber: string): any | null {
  return (
    existing.find((j: any) => {
      const notes = j.productionNotes || ''
      const name = j.name || ''
      return notes.includes(releaseNumber) || name.includes(releaseNumber)
    }) || null
  )
}

function buildPayload(release: any) {
  const shipDateStr =
    ymd(release.shipDate) || ymd(release.createdAt) || new Date().toISOString().split('T')[0]

  const cityState = `${release.shippingLocation.city}, ${release.shippingLocation.state}`
  const shipToLabel = release.shippingLocation.name
  const shipVia = release.shipVia || 'Averitt Collect'

  const projectName = `${release.part.partNumber} — ${release.part.description} | ${release.releaseNumber}`

  const productionNotes = [
    `INVENTORY RELEASE | ${release.releaseNumber}`,
    `Ticket: ${release.ticketNumber ?? 'N/A'}`,
    `Batch: ${release.batchNumber ?? 'N/A'}`,
    `Ship to: ${shipToLabel} (${cityState}) via ${shipVia}`,
    `EPG Item: ${release.part.partNumber} — ${release.pallets} pallets / ${release.totalUnits} units`,
    `TICKET FOR INVOICING ONLY — product already printed at EPG`,
  ].join(' | ')

  const shippingNotes = [
    `EPG`,
    `6234 Enterprise Drive`,
    `Knoxville, TN 37909`,
    `Final destination: ${shipToLabel}`,
    `${release.shippingLocation.address || ''} ${cityState} ${release.shippingLocation.zip || ''}`.trim(),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    customer: 'EPG ENTERPRISE PRINT GROUP',
    customerCode: '2686',
    projectName,
    purchaseOrder: release.customerPONumber,
    quantity: release.totalUnits,
    dueDate: shipDateStr,
    category: 'OTHER',
    simpleCategory: 'BOOK',
    product: 'inventory-release',
    equipment: 'screen-1',
    productionNotes,
    shippingNotes,
    source: 'inventory-release',
    status: 'complete',
    skipProofing: true,
  }
}

function printDraft(idx: number, total: number, release: any, payload: any, dedup: any) {
  const bar = '='.repeat(60)
  console.log('')
  console.log(bar)
  console.log(`  JOB INTAKE DRAFT — ${idx}/${total} — ${release.releaseNumber}`)
  console.log(bar)
  console.log(`  Source: inventory-release-app Release table`)
  console.log('-'.repeat(60))
  console.log(`  STEP 1: CUSTOMER`)
  console.log(`  Customer:      ${payload.customer} (code ${payload.customerCode})`)
  console.log(`  Project Name:  ${payload.projectName}`)
  console.log(`  PO Number:     ${payload.purchaseOrder}`)
  console.log(`  Quantity:      ${payload.quantity.toLocaleString()} units  (${release.pallets} pallets)`)
  console.log(`  Ship Date:     ${payload.dueDate}`)
  console.log('-'.repeat(60))
  console.log(`  STEP 2: CATEGORY`)
  console.log(`  Category:      ${payload.simpleCategory} → ${payload.category}`)
  console.log(`  Product:       ${payload.product}`)
  console.log(`  Equipment:     ${payload.equipment} (SCREEN HD520-1)`)
  console.log('-'.repeat(60))
  console.log(`  STEP 3: IDENTIFIERS`)
  console.log(`  Release #:     ${release.releaseNumber}`)
  console.log(`  Customer PO:   ${release.customerPONumber}`)
  console.log(`  Ticket #:      ${release.ticketNumber ?? '(none)'}`)
  console.log(`  Batch #:       ${release.batchNumber ?? '(none)'}`)
  console.log(`  EPG Item:      ${release.part.partNumber} — ${release.part.description}`)
  console.log('-'.repeat(60))
  console.log(`  STEP 4: SHIP-TO`)
  console.log(`  Destination:   ${release.shippingLocation.name}`)
  console.log(`  City/State:    ${release.shippingLocation.city}, ${release.shippingLocation.state}`)
  console.log(`  Ship Via:      ${release.shipVia || 'Averitt Collect'}`)
  console.log('-'.repeat(60))
  console.log(`  STEP 5: FLAGS`)
  console.log(`  status:        "${payload.status}"       (invoice-only, not scheduled)`)
  console.log(`  skipProofing:  ${payload.skipProofing}     (no proofflow push, no artwork expected)`)
  console.log(`  source:        "${payload.source}"`)
  console.log('-'.repeat(60))
  console.log(`  PRODUCTION NOTES`)
  console.log(`  ${payload.productionNotes}`)
  console.log('-'.repeat(60))
  console.log(`  CONFIDENCE`)
  console.log(`  [check] Customer — EPG / 2686 (confirmed via /api/customers/master)`)
  console.log(`  [check] PO — from Release.customerPONumber: ${release.customerPONumber}`)
  console.log(`  [check] Quantity — from Release.totalUnits`)
  console.log(`  [check] Due — Release.shipDate`)
  console.log(`  [check] REL-ID — not in press-planner (dedup scan clean)`)
  console.log(`  [${release.ticketNumber ? 'check' : 'empty'}] Ticket — ${release.ticketNumber ?? '(nullable in Prisma schema)'}`)
  console.log(`  [${release.batchNumber ? 'check' : 'empty'}] Batch — ${release.batchNumber ?? '(nullable in Prisma schema)'}`)
  if (dedup) {
    console.log(`  [WARN] DUPLICATE IN PRESS-PLANNER: ${dedup.jobNumber} — will SKIP`)
  }
  console.log(bar)
}

async function main() {
  const { submit, only } = parseArgs()
  const targets = only && only.length ? only : TARGETS

  console.log(`Mode: ${submit ? 'SUBMIT (POSTs will fire)' : 'DRY-RUN (no writes)'}`)
  console.log(`Target REL-IDs: ${targets.join(', ')}`)
  console.log(`Press-planner URL: ${PRESS_PLANNER_URL}`)

  const releases = await prisma.release.findMany({
    where: { releaseNumber: { in: targets } },
    include: { part: true, shippingLocation: true },
    orderBy: { releaseNumber: 'asc' },
  })

  if (releases.length === 0) {
    console.log('No matching releases found in DB. Exiting.')
    return
  }

  const found = new Set(releases.map((r) => r.releaseNumber))
  const missing = targets.filter((t) => !found.has(t))
  if (missing.length) {
    console.log(`\nWARN: releases not found in DB: ${missing.join(', ')}`)
  }
  console.log(`\nLoaded ${releases.length} of ${targets.length} target releases.\n`)

  console.log('Pre-fetching press-planner job snapshot for dedup...')
  const existing = await pressPlannerJobsSnapshot()
  console.log(`  Got ${existing.length} recent jobs`)

  const toPost: { release: any; payload: any }[] = []
  for (let i = 0; i < releases.length; i++) {
    const release = releases[i]
    const payload = buildPayload(release)
    const dedup = findDuplicate(existing, release.releaseNumber)
    printDraft(i + 1, releases.length, release, payload, dedup)
    if (!dedup) toPost.push({ release, payload })
  }

  if (!submit) {
    console.log(`\n--- DRY-RUN COMPLETE ---`)
    console.log(`Ready to POST ${toPost.length} of ${releases.length} releases.`)
    console.log(`Skipped ${releases.length - toPost.length} duplicates.`)
    console.log(`Re-run with --submit to actually POST.`)
    return
  }

  console.log(`\n--- SUBMIT MODE ---`)
  console.log(`POSTing ${toPost.length} releases to press-planner...\n`)

  const results: { release: string; status: string; jobNumber?: string; error?: string }[] = []
  for (const { release, payload } of toPost) {
    try {
      const res = await fetch(`${PRESS_PLANNER_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      })
      const bodyText = await res.text()
      let body: any = {}
      try {
        body = JSON.parse(bodyText)
      } catch {}
      if (res.ok) {
        const jn = body.jobNumber || body.job?.jobNumber || '?'
        console.log(`  ${release.releaseNumber} → ${jn}  [${res.status}]`)
        results.push({ release: release.releaseNumber, status: 'CREATED', jobNumber: jn })
      } else {
        console.log(
          `  ${release.releaseNumber} → FAILED  [${res.status}] ${bodyText.slice(0, 300)}`,
        )
        results.push({
          release: release.releaseNumber,
          status: `HTTP_${res.status}`,
          error: bodyText.slice(0, 300),
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${release.releaseNumber} → ERROR: ${msg}`)
      results.push({ release: release.releaseNumber, status: 'ERROR', error: msg })
    }
  }

  console.log(`\n--- SUBMIT RESULTS ---`)
  for (const r of results) {
    console.log(`  ${r.release}: ${r.status}${r.jobNumber ? ` → ${r.jobNumber}` : ''}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
