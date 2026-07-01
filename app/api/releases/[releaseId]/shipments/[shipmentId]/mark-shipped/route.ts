import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { sendShipConfirmationEmail } from '@/lib/email/sendgrid'
import { EPG_DEFAULT_CARRIER } from '@/lib/epg'
import { syncReleaseStatusFromShipments } from '@/lib/shipments/helpers'

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ releaseId: string; shipmentId: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(authHeader.substring(7))
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { releaseId, shipmentId } = await params
    const body = await request.json().catch(() => ({}))
    const { proNumber, carrier, shipDate } = body as {
      proNumber?: string
      carrier?: string
      shipDate?: string
    }

    if (!proNumber?.trim()) {
      return NextResponse.json({ error: 'PRO number is required' }, { status: 400 })
    }

    const shipment = await prisma.releaseShipment.findFirst({
      where: { id: shipmentId, releaseId },
      include: {
        release: { include: { part: true, shippingLocation: true } },
      },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    if (shipment.status === 'SHIPPED') {
      return NextResponse.json({ error: 'Shipment already marked shipped' }, { status: 400 })
    }

    const shippedAt = shipDate ? new Date(shipDate) : new Date()
    const finalCarrier =
      (carrier && carrier.trim()) || shipment.carrier || EPG_DEFAULT_CARRIER

    const updatedShipment = await prisma.releaseShipment.update({
      where: { id: shipmentId },
      data: {
        proNumber: proNumber.trim(),
        carrier: finalCarrier,
        shippedAt,
        shipDate: shippedAt,
        status: 'SHIPPED',
      },
    })

    const release = shipment.release
    const allShipments = await prisma.releaseShipment.findMany({
      where: { releaseId },
      orderBy: { shipmentNumber: 'asc' },
    })
    const allShipped = allShipments.every((s) => s.status === 'SHIPPED')

    await prisma.release.update({
      where: { id: releaseId },
      data: {
        proNumber: allShipped ? proNumber.trim() : release.proNumber,
        carrier: finalCarrier,
        shippedAt: allShipped ? shippedAt : release.shippedAt,
        shippedByUserId: user.id,
        trackingNumber: allShipped ? proNumber.trim() : release.trackingNumber,
        shipDate: release.shipDate ?? shippedAt,
      },
    })

    await syncReleaseStatusFromShipments(releaseId)

    try {
      await sendShipConfirmationEmail({
        releaseNumber: `${release.releaseNumber} (Shipment ${shipment.shipmentNumber})`,
        customerPONumber: release.customerPONumber,
        partNumber: release.part.partNumber,
        partDescription: release.part.description,
        totalUnits: shipment.totalUnits,
        pallets: shipment.pallets,
        boxes: shipment.boxes,
        proNumber: proNumber.trim(),
        carrier: finalCarrier,
        shippedAt,
      })
    } catch (emailError) {
      console.error('❌ Ship confirmation email failed:', emailError)
    }

    const updatedRelease = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        part: true,
        shippingLocation: true,
        shipments: { orderBy: { shipmentNumber: 'asc' } },
        user: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({
      shipment: updatedShipment,
      release: updatedRelease,
    })
  } catch (error) {
    console.error('Error marking shipment shipped:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}