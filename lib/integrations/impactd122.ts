// impactd122 Integration Client
// Creates jobs in impactd122 when releases are created via webhook

const IMPACTD122_API_URL = process.env.IMPACTD122_API_URL
const IMPACTD122_CUSTOMER_ID = process.env.IMPACTD122_CUSTOMER_ID
const IMPACTD122_WEBHOOK_SECRET = process.env.IMPACTD122_WEBHOOK_SECRET

export interface ImpactJobPayload {
  // Required fields for webhook
  externalJobId: string      // Release ID in our system
  jobNo: string              // Release number (e.g., REL-20241211-0001)
  companyName: string        // Company name for lookup/creation in ImpactD122

  // Optional fields
  title?: string
  customerPONumber?: string
  sizeName?: string
  quantity?: number
  specs?: Record<string, unknown>
  status?: string
  deliveryDate?: string
  createdAt?: string
}

export interface ImpactJobResult {
  success: boolean
  jobId?: string
  error?: string
}

/**
 * Check if impactd122 integration is configured
 */
export function isImpactd122Configured(): boolean {
  return !!(IMPACTD122_API_URL && IMPACTD122_WEBHOOK_SECRET)
}

/**
 * Get the configured customer ID for impactd122
 */
export function getImpactd122CustomerId(): string {
  return IMPACTD122_CUSTOMER_ID || ''
}

/**
 * Create a job in impactd122 via webhook endpoint
 */
export async function createImpactJob(payload: ImpactJobPayload): Promise<ImpactJobResult> {
  if (!IMPACTD122_API_URL) {
    console.log('[impactd122] API URL not configured, skipping')
    return { success: false, error: 'Not configured' }
  }

  if (!IMPACTD122_WEBHOOK_SECRET) {
    console.log('[impactd122] Webhook secret not configured, skipping')
    return { success: false, error: 'Webhook secret not configured' }
  }

  try {
    const response = await fetch(`${IMPACTD122_API_URL}/api/webhooks/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': IMPACTD122_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log(`[impactd122] Job created via webhook: ${data.jobId} (${data.jobNo})`)
    return { success: true, jobId: data.jobId }
  } catch (error) {
    console.error('[impactd122] Error creating job via webhook:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
