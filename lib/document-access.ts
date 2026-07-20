/**
 * Shared access + lookup for the release document routes (packing slip, box
 * labels, load flags, JD paperwork).
 *
 * Two things these routes need beyond the original user-JWT check:
 *
 * 1. Service callers. jd-press-planner renders these documents inside its own
 *    Files panel so staff open every file for a job in one place instead of
 *    logging into IRA. It calls server-to-server with a shared key; the key
 *    never reaches a browser.
 *
 * 2. Lookup by releaseNumber. Press-planner stores the release number on the
 *    job (jobs.external_ref) and has no idea what IRA's cuid is, so the routes
 *    accept either identifier.
 *
 * Nothing here weakens the human path — a request with no service key still has
 * to present an ADMIN user token exactly as before.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

/** Set IRA_SERVICE_KEY on both IRA and press-planner to enable the service path. */
function serviceKeyConfigured(): string | null {
  const key = process.env.IRA_SERVICE_KEY
  return key && key.length >= 16 ? key : null
}

/**
 * True when this request carries the service key.
 *
 * Compared with a length-safe constant-time-ish check. Deliberately does NOT
 * fall back to "allow" when the key is unset — an unconfigured deployment must
 * behave exactly as it did before this file existed.
 */
export function isServiceRequest(request: NextRequest): boolean {
  const configured = serviceKeyConfigured()
  if (!configured) return false

  const provided = request.headers.get('x-api-key')
  if (!provided || provided.length !== configured.length) return false

  let mismatch = 0
  for (let i = 0; i < configured.length; i++) {
    mismatch |= configured.charCodeAt(i) ^ provided.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Authorize a document request. Returns null when allowed, or the response to
 * return when not.
 *
 * `requireAdmin` defaults to true because the dock paperwork routes (load flags,
 * JD paperwork/BOL) are admin-only. The customer-facing download route passes
 * false — customers are meant to fetch their own packing slip and labels, and
 * quietly tightening that would lock them out.
 */
export async function authorizeDocumentRequest(
  request: NextRequest,
  { requireAdmin = true }: { requireAdmin?: boolean } = {},
): Promise<NextResponse | null> {
  if (isServiceRequest(request)) return null

  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null
  const token = tokenFromHeader || request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
  if (requireAdmin && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return null
}

/**
 * Match the :releaseId path segment against IRA's cuid OR a release number like
 * "REL-20260709-0046" — press-planner only knows the number.
 *
 * Returned as a where clause rather than a wrapper function so each route keeps
 * its own `include` and Prisma's type inference stays intact. Both columns are
 * unique, so the OR can match at most one row.
 *
 *   const release = await prisma.release.findFirst({
 *     where: releaseWhereIdOrNumber(releaseId),
 *     include: { part: true, shippingLocation: true },
 *   })
 */
export function releaseWhereIdOrNumber(identifier: string) {
  return { OR: [{ id: identifier }, { releaseNumber: identifier }] }
}
