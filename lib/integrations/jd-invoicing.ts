// JD Invoicing Integration
// Pushes inventory releases as jobs to jd-invoicing for tracking + invoicing
// These are NOT press jobs — product is already printed (warehouse/shipping operation)

const JD_INVOICING_URL = process.env.JD_INVOICING_URL

export function isJdInvoicingConfigured(): boolean {
  return !!JD_INVOICING_URL
}

interface JdInvoicingJobPayload {
  jobNumber?: string           // Optional — let jd-invoicing auto-generate if omitted
  client: string               // "EPG Enterprise Print Group"
  description: string          // e.g., "100307705 — MANUAL, 36 PAGE, RES, GAS, UNBRANDED"
  quantity: string             // Total units as string
  poNumber: string             // Customer PO#
  dueDate: string              // Ship date as YYYY-MM-DD
  pressType: string            // "digital-inkjet" (already printed on SCREEN)
  notes: string                // Release + shipping details
  jobType?: string             // Optional job type
  releaseNumber?: string       // For dedup — e.g., "REL-20260314-0001"
}

interface JdInvoicingResult {
  success: boolean
  jobNumber?: string
  error?: string
  skipped?: boolean
}

/**
 * Check if a job for this release already exists in jd-invoicing.
 * Searches the description field which includes the release number.
 */
async function checkDuplicate(releaseNumber: string): Promise<string | null> {
  if (!JD_INVOICING_URL || !releaseNumber) return null

  try {
    const res = await fetch(
      `${JD_INVOICING_URL}/api/jobs?search=${encodeURIComponent(releaseNumber)}&client=epg`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) return null

    const data = await res.json()
    const jobs = data.jobs || data || []

    // Check if any existing job's description contains this release number
    for (const job of jobs) {
      if (
        job.description?.includes(releaseNumber) ||
        job.notes?.includes(releaseNumber)
      ) {
        return job.jobNumber
      }
    }
    return null
  } catch {
    // Dedup check failure should not block job creation
    console.warn('[jd-invoicing] Dedup check failed, proceeding with creation')
    return null
  }
}

/**
 * Create a job in JD Invoicing for an inventory release.
 * Fire-and-forget pattern — release creation succeeds even if this fails.
 * Checks for duplicates before creating to prevent double-billing.
 */
export async function createJdInvoicingJob(payload: JdInvoicingJobPayload): Promise<JdInvoicingResult> {
  if (!JD_INVOICING_URL) {
    console.log('[jd-invoicing] URL not configured, skipping')
    return { success: false, error: 'Not configured' }
  }

  // Dedup check — skip if this release already exists
  if (payload.releaseNumber) {
    const existingJobNumber = await checkDuplicate(payload.releaseNumber)
    if (existingJobNumber) {
      console.log(`[jd-invoicing] Duplicate detected — ${payload.releaseNumber} already exists as ${existingJobNumber}, skipping`)
      return { success: true, jobNumber: existingJobNumber, skipped: true }
    }
  }

  try {
    const response = await fetch(`${JD_INVOICING_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log(`[jd-invoicing] Job created: ${data.jobNumber} — ${payload.description}`)
    return { success: true, jobNumber: data.jobNumber }
  } catch (error) {
    console.error('[jd-invoicing] Error creating job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
