/**
 * GET /api/releases/[releaseId]/jd-paperwork
 *
 * Returns a single PDF: JD packing slip + BOL + one pallet flag per skid.
 * Admin-only.
 *
 * Per Apr 2026 EPG new process: JD ships EPG releases on JD's own paperwork
 * (XPO on JD account JDGRCCTS900, manual phone booking). The shipping party
 * prints this PDF and attaches it to the skids before pickup.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { generateJdShipmentPaperwork } from '@/lib/documents/jd-shipment-paperwork'
import {
  appendLoadFlagsPages,
  type LoadFlagSkid,
} from '@/lib/documents/load-flags'
import {
  EPG_DEFAULT_CARRIER,
  EPG_DEFAULT_CARRIER_ACCOUNT,
  EPG_DEFAULT_FREIGHT_TERMS,
  EPG_DEFAULT_LBS_PER_PALLET,
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
    const carrier = release.carrier || EPG_DEFAULT_CARRIER
    const carrierAccountNumber =
      release.carrierAccountNumber || EPG_DEFAULT_CARRIER_ACCOUNT
    const totalWeight =
      release.weight && release.weight > 0
        ? release.weight
        : Math.max(1, release.pallets) * EPG_DEFAULT_LBS_PER_PALLET
    const shippingClass = release.shippingClass || '55'
    const freightTerms = release.freightTerms || EPG_DEFAULT_FREIGHT_TERMS

    const doc = generateJdShipmentPaperwork({
      releaseNumber: release.releaseNumber,
      ticketNumber: release.ticketNumber || 'N/A',
      customerPONumber: release.customerPONumber,
      date: release.createdAt,
      shipDate: release.shipDate ?? null,
      carrier,
      carrierAccountNumber,
      freightTerms,
      pallets: release.pallets,
      cartons,
      weight: totalWeight,
      shippingClass,
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

    // Append one pallet flag page per skid (even-split units/cartons/weight,
    // remainder on the last skid).
    const palletCount = Math.max(1, release.pallets)
    const baseUnits = Math.floor(release.totalUnits / palletCount)
    const baseCartons = Math.floor(cartons / palletCount)
    const baseWeight = Math.round((totalWeight / palletCount) * 100) / 100
    const skids: LoadFlagSkid[] = Array.from({ length: palletCount }, (_, i) => {
      const skidNumber = i + 1
      const isLast = skidNumber === palletCount
      return {
        skidNumber,
        partNumber: release.part.partNumber,
        description: release.part.description,
        unitsPerBox: release.part.unitsPerBox,
        units: isLast
          ? release.totalUnits - baseUnits * (palletCount - 1)
          : baseUnits,
        cartons: isLast ? cartons - baseCartons * (palletCount - 1) : baseCartons,
        weight: isLast
          ? Math.round((totalWeight - baseWeight * (palletCount - 1)) * 100) / 100
          : baseWeight,
      }
    })
    appendLoadFlagsPages(doc, {
      releaseNumber: release.releaseNumber,
      date: release.createdAt,
      carrier,
      customerPONumber: release.customerPONumber,
      totalSkids: palletCount,
      totalWeight,
      shippingClass,
      skidType: release.skidType,
      batchNumber: release.batchNumber ?? undefined,
      skids,
    })

    const pdf = Buffer.from(doc.output('arraybuffer'))

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
