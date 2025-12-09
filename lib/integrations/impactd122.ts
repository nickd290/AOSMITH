// impactd122 Integration Client
// Creates jobs in impactd122 when releases are created

const IMPACTD122_API_URL = process.env.IMPACTD122_API_URL
const IMPACTD122_CUSTOMER_ID = process.env.IMPACTD122_CUSTOMER_ID

export interface ImpactJobPayload {
  customerId: string
  title: string
  description: string
  specs: Record<string, unknown>
  quantity: number
  customerPONumber: string
  sellPrice?: number
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
  return !!(IMPACTD122_API_URL && IMPACTD122_CUSTOMER_ID)
}

/**
 * Get the configured customer ID for impactd122
 */
export function getImpactd122CustomerId(): string {
  return IMPACTD122_CUSTOMER_ID || ''
}

/**
 * Create a job in impactd122
 */
export async function createImpactJob(payload: ImpactJobPayload): Promise<ImpactJobResult> {
  if (!IMPACTD122_API_URL) {
    console.log('[impactd122] API URL not configured, skipping')
    return { success: false, error: 'Not configured' }
  }

  try {
    const response = await fetch(`${IMPACTD122_API_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log(`[impactd122] Job created: ${data.id}`)
    return { success: true, jobId: data.id }
  } catch (error) {
    console.error('[impactd122] Error creating job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
