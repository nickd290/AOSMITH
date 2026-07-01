/**
 * GET /api/releases/[releaseId]/load-flags
 *
 * Returns one PDF page per skid (8.5×11) for the release. Admin-only.
 * Stick one to each pallet so the dock crew + driver can read FROM/TO/contents
 * across the dock.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { generateLoadFlagsBuffer } from '@/lib/documents/load-flags'
import { ensureDefaultShipment } from '@/lib/shipments/helpers'
import { buildLoadFlagsForShipment } from '@/lib/shipments/paperwork'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization')
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null
    const tokenFromQuery = request.nextUrl.searchParams.get('token')
    const token = tokenFromHeader || tokenFromQuery

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { releaseId } = await params
    const shipmentId = request.nextUrl.searchParams.get('shipmentId')

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { part: true, shippingLocation: true },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const allShipments = await ensureDefaultShipment(release)
    const shipment =
      (shipmentId
        ? allShipments.find((s) => s.id === shipmentId)
        : allShipments.find((s) => s.status === 'PENDING')) ?? allShipments[0]

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    const flags = buildLoadFlagsForShipment(release, shipment, allShipments)

    const pdf = generateLoadFlagsBuffer({
      releaseNumber: release.releaseNumber,
      date: release.createdAt,
      carrier: flags.carrier,
      customerPONumber: flags.customerPONumber,
      totalSkids: flags.totalSkids,
      totalWeight: flags.totalWeight,
      shippingClass: flags.shippingClass,
      skidType: flags.skidType,
      batchNumber: flags.batchNumber,
      skids: flags.skids,
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="JD-${release.releaseNumber}-pallet-flags.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating pallet flags:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
