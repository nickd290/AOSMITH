// Press-Planner Integration
// Creates one job in jd-press-planner per EPG inventory release.
// The job is born with skipProofing=true (proofflow skipped) and gets flipped to
// status='complete' after creation so it doesn't pollute the production schedule.
// Press-planner's Flow 1 fan-out handles the jd-invoicing Sheets row — do not
// also call jd-invoicing directly from here.

const PRESS_PLANNER_URL = process.env.PRESS_PLANNER_URL
const PRESS_PLANNER_TOKEN = process.env.PRESS_PLANNER_TOKEN

export function isPressPlannerConfigured(): boolean {
  return !!PRESS_PLANNER_URL
}

interface PressPlannerJobPayload {
  releaseNumber: string
  customerPONumber: string
  partNumber: string
  partDescription: string
  totalUnits: number
  pallets: number
  shipDateStr: string
  ticketNumber?: string | null
  batchNumber?: string | null
  shippingLocationName: string
  shippingLocationCity: string
  shippingLocationState: string
  shippingLocationAddress?: string | null
  shippingLocationZip?: string | null
  shipVia: string
}

interface PressPlannerResult {
  success: boolean
  jobNumber?: string
  jobId?: string
  error?: string
  skipped?: boolean
  statusFlipped?: boolean
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (PRESS_PLANNER_TOKEN) h['Authorization'] = `Bearer ${PRESS_PLANNER_TOKEN}`
  return h
}

interface PressPlannerJobRow {
  id: string
  jobNumber: string
  name?: string | null
  productionNotes?: string | null
}

async function fetchRecentJobs(): Promise<PressPlannerJobRow[]> {
  if (!PRESS_PLANNER_URL) return []
  try {
    const res = await fetch(
      `${PRESS_PLANNER_URL}/api/jobs?includeAll=true&limit=500`,
      { headers: authHeaders(), signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) {
      console.warn(`[press-planner] GET /api/jobs returned ${res.status} — proceeding cautiously`)
      return []
    }
    const data = await res.json()
    return (data.jobs as PressPlannerJobRow[]) || []
  } catch (err) {
    console.warn('[press-planner] Dedup/lookup fetch failed:', err instanceof Error ? err.message : err)
    return []
  }
}

function findByReleaseNumber(rows: PressPlannerJobRow[], releaseNumber: string): PressPlannerJobRow | null {
  return (
    rows.find((j) => {
      const notes = j.productionNotes || ''
      const name = j.name || ''
      return notes.includes(releaseNumber) || name.includes(releaseNumber)
    }) || null
  )
}

function findByJobNumber(rows: PressPlannerJobRow[], jobNumber: string): PressPlannerJobRow | null {
  return rows.find((j) => j.jobNumber === jobNumber) || null
}

function buildBody(p: PressPlannerJobPayload) {
  const cityState = `${p.shippingLocationCity}, ${p.shippingLocationState}`
  const projectName = `${p.partNumber} — ${p.partDescription} | ${p.releaseNumber}`

  const productionNotes = [
    `INVENTORY RELEASE | ${p.releaseNumber}`,
    `Ticket: ${p.ticketNumber ?? 'N/A'}`,
    `Batch: ${p.batchNumber ?? 'N/A'}`,
    `Ship to: ${p.shippingLocationName} (${cityState}) via ${p.shipVia}`,
    `EPG Item: ${p.partNumber} — ${p.pallets} pallets / ${p.totalUnits} units`,
    `TICKET FOR INVOICING ONLY — product already printed at EPG`,
  ].join(' | ')

  const shippingNotes = [
    `EPG`,
    `6234 Enterprise Drive`,
    `Knoxville, TN 37909`,
    `Final destination: ${p.shippingLocationName}`,
    `${p.shippingLocationAddress || ''} ${cityState} ${p.shippingLocationZip || ''}`.trim(),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    customer: 'EPG ENTERPRISE PRINT GROUP',
    customerCode: '2686',
    projectName,
    purchaseOrder: p.customerPONumber,
    quantity: p.totalUnits,
    dueDate: p.shipDateStr,
    category: 'OTHER',
    simpleCategory: 'BOOK',
    product: 'inventory-release',
    equipment: 'screen-1',
    productionNotes,
    shippingNotes,
    source: 'inventory-release',
    externalRef: p.releaseNumber,
    skipProofing: true,
  }
}

/**
 * Create a press-planner job for an inventory release.
 *
 * Three steps:
 *   1. Dedup — scan recent press-planner jobs for releaseNumber in
 *      productionNotes/name. Skip if found.
 *   2. Create — POST /api/jobs (wizard orchestrator path: fans out to
 *      jd-invoicing Sheets via Flow 1, skips proofflow because
 *      skipProofing=true).
 *   3. Status flip — PUT /api/jobs/:id with { status: 'complete' } so the
 *      job doesn't sit on the production schedule.
 *
 * Fire-and-forget at the call site: caller must .catch() to keep release
 * creation succeeding even if press-planner is down.
 */
export async function createPressPlannerJob(
  p: PressPlannerJobPayload
): Promise<PressPlannerResult> {
  if (!PRESS_PLANNER_URL) {
    console.log('[press-planner] URL not configured, skipping')
    return { success: false, error: 'Not configured' }
  }

  const existingRows = await fetchRecentJobs()
  const dup = findByReleaseNumber(existingRows, p.releaseNumber)
  if (dup) {
    console.log(
      `[press-planner] Duplicate detected — ${p.releaseNumber} already exists as ${dup.jobNumber}, skipping`
    )
    return { success: true, skipped: true, jobNumber: dup.jobNumber, jobId: dup.id }
  }

  const body = buildBody(p)

  let createdJobNumber: string | undefined
  try {
    const res = await fetch(`${PRESS_PLANNER_URL}/api/jobs`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const text = await res.text()
    let data: { jobNumber?: string; job?: { jobNumber?: string } } = {}
    try {
      data = JSON.parse(text)
    } catch {}
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
    }
    createdJobNumber = data.jobNumber || data.job?.jobNumber
    if (!createdJobNumber) {
      throw new Error(`Press-planner returned 2xx but no jobNumber in body: ${text.slice(0, 200)}`)
    }
    console.log(`[press-planner] Job created: ${createdJobNumber} — ${p.releaseNumber}`)
  } catch (err) {
    console.error('[press-planner] Error creating job:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }

  // Look up the freshly-created job to get its UUID, then flip status → 'complete'.
  // PUT /api/jobs/:id uses the UUID, not the jobNumber.
  let jobId: string | undefined
  try {
    const freshRows = await fetchRecentJobs()
    const row = findByJobNumber(freshRows, createdJobNumber)
    if (!row) {
      console.warn(
        `[press-planner] Created ${createdJobNumber} but couldn't find it in the recent-jobs list — status will stay 'pending'`
      )
      return { success: true, jobNumber: createdJobNumber, statusFlipped: false }
    }
    jobId = row.id
  } catch (err) {
    console.warn('[press-planner] Lookup-after-create failed:', err instanceof Error ? err.message : err)
    return { success: true, jobNumber: createdJobNumber, statusFlipped: false }
  }

  try {
    const res = await fetch(`${PRESS_PLANNER_URL}/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'complete' }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn(
        `[press-planner] Status flip to 'complete' failed for ${createdJobNumber}: HTTP ${res.status} ${text.slice(0, 200)}`
      )
      return { success: true, jobNumber: createdJobNumber, jobId, statusFlipped: false }
    }
    console.log(`[press-planner] Status flipped to complete: ${createdJobNumber}`)
    return { success: true, jobNumber: createdJobNumber, jobId, statusFlipped: true }
  } catch (err) {
    console.warn(
      `[press-planner] Status flip request errored for ${createdJobNumber}:`,
      err instanceof Error ? err.message : err
    )
    return { success: true, jobNumber: createdJobNumber, jobId, statusFlipped: false }
  }
}
