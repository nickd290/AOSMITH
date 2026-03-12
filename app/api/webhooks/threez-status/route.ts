import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * POST /api/webhooks/threez-status
 * Receives status update callbacks from the Three Z Job Portal
 * when a job's status changes (e.g., shipped with tracking info).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobId, sourceJobId, status, trackingNumber, carrier, updatedAt } = body

    if (!sourceJobId) {
      return NextResponse.json(
        { success: false, error: 'sourceJobId is required' },
        { status: 400 }
      )
    }

    console.log(`[threez-webhook] Status update: job=${jobId} sourceJobId=${sourceJobId} status=${status}`)

    // Find the release by sourceJobId (which is the release ID)
    const release = await prisma.release.findUnique({
      where: { id: sourceJobId },
    })

    if (!release) {
      console.warn(`[threez-webhook] Release not found for sourceJobId: ${sourceJobId}`)
      return NextResponse.json(
        { success: false, error: 'Release not found' },
        { status: 404 }
      )
    }

    // If tracking info is provided and release doesn't already have tracking, update it
    if (trackingNumber && !release.trackingNumber) {
      await prisma.release.update({
        where: { id: sourceJobId },
        data: {
          trackingNumber,
          status: 'SHIPPED',
          ...(carrier ? { shipVia: carrier } : {}),
        },
      })
      console.log(`[threez-webhook] Release ${release.releaseNumber} updated: trackingNumber=${trackingNumber} status=SHIPPED`)
    } else {
      console.log(`[threez-webhook] Release ${release.releaseNumber}: status=${status} (no tracking update needed)`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[threez-webhook] Error processing status update:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
