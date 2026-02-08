// Three Z Job Portal Integration
// Creates jobs in the Three Z Job Portal when releases are created

const THREEZ_PORTAL_URL = process.env.THREEZ_PORTAL_URL

export function isThreezPortalConfigured(): boolean {
  return !!THREEZ_PORTAL_URL
}

interface ThreezJobPayload {
  title: string
  customerName: string
  emailBody: string
}

interface ThreezJobResult {
  success: boolean
  jobId?: string
  error?: string
}

/**
 * Create a job in the Three Z Job Portal
 */
export async function createThreezPortalJob(payload: ThreezJobPayload): Promise<ThreezJobResult> {
  if (!THREEZ_PORTAL_URL) {
    console.log('[threez-portal] URL not configured, skipping')
    return { success: false, error: 'Not configured' }
  }

  try {
    const response = await fetch(`${THREEZ_PORTAL_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log(`[threez-portal] Job created: ${data.id} — ${payload.title}`)
    return { success: true, jobId: data.id }
  } catch (error) {
    console.error('[threez-portal] Error creating job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
