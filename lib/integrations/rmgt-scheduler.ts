// RMGT Scheduler Integration
// Pushes inventory releases as "complete" jobs to rmgt-scheduler for visibility
// These are NOT press jobs — product is already printed on SCREEN (warehouse/shipping operation)

const RMGT_SCHEDULER_URL = process.env.RMGT_SCHEDULER_URL
const RMGT_SCHEDULER_SECRET = process.env.RMGT_SCHEDULER_SECRET

export function isRmgtSchedulerConfigured(): boolean {
  return !!RMGT_SCHEDULER_URL
}

interface RmgtSchedulerJobPayload {
  customer: string
  customerCode: string
  projectName: string
  quantity: number
  category: string
  product: string
  equipment: string
  dueDate?: string
  purchaseOrder?: string
  productionNotes?: string
  source?: string
  status?: 'queued' | 'complete'
}

interface RmgtSchedulerResult {
  success: boolean
  jobNumber?: string
  error?: string
  skipped?: boolean
}

/**
 * Create a job in RMGT Scheduler for an inventory release.
 * Marked as "complete" since the product is already printed.
 * Fire-and-forget pattern — release creation succeeds even if this fails.
 */
export async function createRmgtSchedulerJob(payload: RmgtSchedulerJobPayload): Promise<RmgtSchedulerResult> {
  if (!RMGT_SCHEDULER_URL) {
    console.log('[rmgt-scheduler] URL not configured, skipping')
    return { success: false, error: 'Not configured' }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (RMGT_SCHEDULER_SECRET) {
      headers['Authorization'] = `Bearer ${RMGT_SCHEDULER_SECRET}`
    }

    const response = await fetch(`${RMGT_SCHEDULER_URL}/api/new-job`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: payload.customer,
        customerCode: payload.customerCode,
        projectName: payload.projectName,
        quantity: payload.quantity,
        category: payload.category,
        product: payload.product,
        equipment: payload.equipment,
        dueDate: payload.dueDate,
        purchaseOrder: payload.purchaseOrder,
        productionNotes: payload.productionNotes,
        source: payload.source || 'inventory-release',
        status: payload.status || 'complete',
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log(`[rmgt-scheduler] Job created: ${data.jobNumber} — ${payload.projectName}`)
    return { success: true, jobNumber: data.jobNumber }
  } catch (error) {
    console.error('[rmgt-scheduler] Error creating job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
