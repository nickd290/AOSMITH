import { NextResponse } from 'next/server'

/**
 * Customer packing-slip upload — DISABLED Apr 2026.
 *
 * Per Kirk Icuss new EPG process: "We will not be uploading any paperwork as we
 * have in the past." JD now generates its own packing slip + BOL via
 * GET /api/releases/[releaseId]/jd-paperwork. The upload UI was removed from
 * the customer-facing release history page in the same release.
 *
 * Returning 410 Gone (vs. 404) so any stale browser tab or external integration
 * gets a clear "this is intentionally retired" signal rather than thinking it's
 * a bug.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Customer packing-slip upload is disabled. JD now generates shipment paperwork via GET /api/releases/[releaseId]/jd-paperwork.',
    },
    { status: 410 },
  )
}
