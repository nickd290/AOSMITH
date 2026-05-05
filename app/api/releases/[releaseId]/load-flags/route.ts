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
import { generateLoadFlagsBuffer, type LoadFlagSkid } from '@/lib/documents/load-flags'
import { EPG_DEFAULT_CARRIER, EPG_DEFAULT_LBS_PER_PALLET } from '@/lib/epg'

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

    const pallets = Math.max(1, release.pallets)
    const totalUnits = release.totalUnits
    const totalCartons =
      release.cartons ?? release.pallets * release.part.boxesPerPallet + release.boxes
    const totalWeight =
      release.weight && release.weight > 0
        ? release.weight
        : pallets * EPG_DEFAULT_LBS_PER_PALLET

    // Even-split per skid, remainder on the LAST skid (pallet N).
    const baseUnits = Math.floor(totalUnits / pallets)
    const baseCartons = Math.floor(totalCartons / pallets)
    const baseWeight = Math.round((totalWeight / pallets) * 100) / 100

    const skids: LoadFlagSkid[] = Array.from({ length: pallets }, (_, i) => {
      const skidNumber = i + 1
      const isLast = skidNumber === pallets
      const units = isLast ? totalUnits - baseUnits * (pallets - 1) : baseUnits
      const cartons = isLast
        ? totalCartons - baseCartons * (pallets - 1)
        : baseCartons
      const weight = isLast
        ? Math.round((totalWeight - baseWeight * (pallets - 1)) * 100) / 100
        : baseWeight
      return {
        skidNumber,
        partNumber: release.part.partNumber,
        description: release.part.description,
        units,
        cartons,
        unitsPerBox: release.part.unitsPerBox,
        weight,
      }
    })

    const pdf = generateLoadFlagsBuffer({
      releaseNumber: release.releaseNumber,
      date: release.createdAt,
      carrier: release.carrier || EPG_DEFAULT_CARRIER,
      customerPONumber: release.customerPONumber,
      totalSkids: pallets,
      totalWeight,
      shippingClass: release.shippingClass || '55',
      skidType: release.skidType,
      batchNumber: release.batchNumber ?? undefined,
      skids,
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
