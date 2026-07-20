/**
 * GET /api/releases/[releaseId]/load-flags
 *
 * Returns one PDF page per skid (8.5×11) for the release. Admin-only.
 * Stick one to each pallet so the dock crew + driver can read FROM/TO/contents
 * across the dock.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeDocumentRequest, releaseWhereIdOrNumber } from '@/lib/document-access'
import { prisma } from '@/lib/db'
import { generateLoadFlagsBuffer } from '@/lib/documents/load-flags'
import { ensureDefaultShipment } from '@/lib/shipments/helpers'
import { buildLoadFlagsForShipment } from '@/lib/shipments/paperwork'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  try {
    // An ADMIN user token as before, or press-planner calling server-to-server
    // with the service key so staff open this from the job's Files panel.
    const denied = await authorizeDocumentRequest(request)
    if (denied) return denied

    const { releaseId } = await params
    const shipmentId = request.nextUrl.searchParams.get('shipmentId')

    // press-planner addresses releases by number, not by IRA's cuid.
    const release = await prisma.release.findFirst({
      where: releaseWhereIdOrNumber(releaseId),
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
