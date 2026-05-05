/**
 * GET /api/releases/[releaseId]/jd-paperwork
 *
 * Returns a 2-page PDF (JD packing slip + BOL) for the release. Admin-only.
 *
 * Per Apr 2026 EPG new process: JD ships EPG releases on JD's own paperwork
 * (XPO on JD account JDGRCCTS900, manual phone booking). The shipping party
 * prints this PDF and attaches it to the skids before pickup.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { generateJdShipmentPaperworkBuffer } from '@/lib/documents/jd-shipment-paperwork'
import {
  EPG_DEFAULT_CARRIER,
  EPG_DEFAULT_CARRIER_ACCOUNT,
  EPG_DEFAULT_FREIGHT_TERMS,
} from '@/lib/epg'

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

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { part: true, shippingLocation: true },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const cartons =
      release.cartons ?? release.pallets * release.part.boxesPerPallet + release.boxes

    const pdf = generateJdShipmentPaperworkBuffer({
      releaseNumber: release.releaseNumber,
      ticketNumber: release.ticketNumber || 'N/A',
      customerPONumber: release.customerPONumber,
      date: release.createdAt,
      shipDate: release.shipDate ?? null,
      carrier: release.carrier || EPG_DEFAULT_CARRIER,
      carrierAccountNumber:
        release.carrierAccountNumber || EPG_DEFAULT_CARRIER_ACCOUNT,
      freightTerms: release.freightTerms || EPG_DEFAULT_FREIGHT_TERMS,
      pallets: release.pallets,
      cartons,
      weight: release.weight ?? 0,
      shippingClass: release.shippingClass || '55',
      skidType: release.skidType,
      notes: release.notes,
      lineItems: [
        {
          partNumber: release.part.partNumber,
          description: release.part.description,
          unitsPerBox: release.part.unitsPerBox,
          ordered: release.totalUnits,
          shipped: release.totalUnits,
        },
      ],
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="JD-${release.releaseNumber}-paperwork.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating JD paperwork:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
