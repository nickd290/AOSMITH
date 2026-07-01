import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { syncReleaseStatusFromShipments } from '@/lib/shipments/helpers'

/**
 * POST /api/releases/[releaseId]/shipments/[shipmentId]/unmark-shipped
 *
 * Reverts a shipment from SHIPPED → PENDING (admin only). Clears PRO # on
 * that truck line and recalculates release status (OPEN / PARTIAL).
 */
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

    const shipment = await prisma.releaseShipment.findFirst({
      where: { id: shipmentId, releaseId },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    if (shipment.status !== 'SHIPPED') {
      return NextResponse.json(
        { error: 'Only shipped shipments can be reverted' },
        { status: 400 },
      )
    }

    const updatedShipment = await prisma.releaseShipment.update({
      where: { id: shipmentId },
      data: {
        status: 'PENDING',
        proNumber: null,
        shippedAt: null,
      },
    })

    await syncReleaseStatusFromShipments(releaseId)

    const updatedRelease = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        part: true,
        shippingLocation: true,
        shipments: { orderBy: { shipmentNumber: 'asc' } },
        user: { select: { name: true, email: true } },
      },
    })

    console.log(
      `↩️ Release ${updatedRelease?.releaseNumber} shipment ${shipment.shipmentNumber} reverted to PENDING`,
    )

    return NextResponse.json({
      shipment: updatedShipment,
      release: updatedRelease,
    })
  } catch (error) {
    console.error('Error unmarking shipment shipped:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}