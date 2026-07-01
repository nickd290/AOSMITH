import { NextRequest, NextResponse } from 'next/server'
import type { ReleaseShipment } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import {
  ensureDefaultShipment,
  shipmentTotals,
  syncReleaseStatusFromShipments,
  validatePalletSplits,
} from '@/lib/shipments/helpers'

/**
 * POST /api/releases/[releaseId]/split-shipment
 *
 * Split an EPG release into truck-sized sub-shipments while keeping the
 * original skid count on the release (e.g. 5 total → [2, 3]).
 *
 * Body: { palletSplits: number[] }  — must sum to release.pallets, or to
 * remaining skids if some shipments are already SHIPPED.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(authHeader.substring(7))
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { releaseId } = await params
    const body = await request.json()
    const palletSplits: number[] = body.palletSplits

    if (!Array.isArray(palletSplits)) {
      return NextResponse.json(
        { error: 'palletSplits array is required' },
        { status: 400 },
      )
    }

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { part: true },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && release.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureDefaultShipment(release)

    const existing = await prisma.releaseShipment.findMany({
      where: { releaseId },
      orderBy: { shipmentNumber: 'asc' },
    })

    const shipped = existing.filter((s) => s.status === 'SHIPPED')
    const shippedPallets = shipped.reduce((sum, s) => sum + s.pallets, 0)
    const targetPallets =
      shipped.length > 0 ? release.pallets - shippedPallets : release.pallets

    if (targetPallets <= 0) {
      return NextResponse.json(
        { error: 'All skids on this release have already shipped' },
        { status: 400 },
      )
    }

    const validationError = validatePalletSplits(palletSplits, targetPallets)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const shipments = await prisma.$transaction(async (tx) => {
      if (shipped.length > 0) {
        await tx.releaseShipment.deleteMany({
          where: { releaseId, status: 'PENDING' },
        })
      } else {
        await tx.releaseShipment.deleteMany({ where: { releaseId } })
      }

      const nextNumber =
        shipped.length > 0
          ? Math.max(...shipped.map((s) => s.shipmentNumber)) + 1
          : 1

      const created: ReleaseShipment[] = []
      for (let i = 0; i < palletSplits.length; i++) {
        const pallets = palletSplits[i]
        const totals = shipmentTotals(pallets, 0, release.part)
        const row = await tx.releaseShipment.create({
          data: {
            releaseId,
            shipmentNumber: nextNumber + i,
            pallets,
            boxes: 0,
            totalUnits: totals.totalUnits,
            cartons: totals.cartons,
            weight: totals.weight,
            status: 'PENDING',
            carrier: release.carrier,
            shipDate: release.shipDate,
          },
        })
        created.push(row)
      }

      return [...shipped, ...created]
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

    return NextResponse.json({
      release: updatedRelease,
      shipments,
    })
  } catch (error) {
    console.error('Error splitting shipment:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}