/**
 * POST /api/releases/[releaseId]/mark-shipped
 *
 * Marks a release as shipped. Captures FedEx Freight PRO #, optional carrier
 * override, optional ship date (defaults to now). Sets status=SHIPPED, fires
 * the shipment confirmation email to EPG (Alecia + cc Kirk + JD team).
 *
 * Per Apr 2026 EPG new process: this is the new "ship event" trigger — replaces
 * the old "customer uploaded packing slip → ready to ship" flow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { sendShipConfirmationEmail } from '@/lib/email/sendgrid'
import { EPG_DEFAULT_CARRIER } from '@/lib/epg'
import { ensureDefaultShipment, syncReleaseStatusFromShipments } from '@/lib/shipments/helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { releaseId } = await params
    const body = await request.json().catch(() => ({}))
    const { proNumber, carrier, shipDate } = body as {
      proNumber?: string
      carrier?: string
      shipDate?: string
    }

    if (!proNumber || typeof proNumber !== 'string' || proNumber.trim().length === 0) {
      return NextResponse.json({ error: 'PRO number is required' }, { status: 400 })
    }

    const existing = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { part: true, shippingLocation: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const shippedAt = shipDate ? new Date(shipDate) : new Date()
    const finalCarrier = (carrier && carrier.trim()) || existing.carrier || EPG_DEFAULT_CARRIER
    const trimmedPro = proNumber.trim()

    await ensureDefaultShipment(existing)

    const pendingShipments = await prisma.releaseShipment.findMany({
      where: { releaseId, status: 'PENDING' },
    })
    if (pendingShipments.length === 0) {
      return NextResponse.json(
        { error: 'All shipments on this release are already marked shipped' },
        { status: 400 },
      )
    }

    await prisma.releaseShipment.updateMany({
      where: { releaseId, status: 'PENDING' },
      data: {
        status: 'SHIPPED',
        proNumber: trimmedPro,
        carrier: finalCarrier,
        shippedAt,
      },
    })

    await syncReleaseStatusFromShipments(releaseId)

    const updated = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { part: true, shippingLocation: true, shipments: { orderBy: { shipmentNumber: 'asc' } } },
    })
    if (!updated) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    await prisma.release.update({
      where: { id: releaseId },
      data: { shippedByUserId: user.id },
    })

    // Fire confirmation email — non-blocking on failure (release is already shipped).
    try {
      await sendShipConfirmationEmail({
        releaseNumber: updated.releaseNumber,
        customerPONumber: updated.customerPONumber,
        partNumber: updated.part.partNumber,
        partDescription: updated.part.description,
        totalUnits: updated.totalUnits,
        pallets: updated.pallets,
        boxes: updated.boxes,
        proNumber: updated.proNumber!,
        carrier: updated.carrier!,
        shippedAt: updated.shippedAt!,
      })
    } catch (emailError) {
      console.error('❌ Ship confirmation email failed:', emailError)
    }

    const { customerPackingSlipData: _omit, ...rest } = updated as typeof updated & {
      customerPackingSlipData?: unknown
    }
    return NextResponse.json({ release: rest })
  } catch (error) {
    console.error('Error marking release shipped:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
