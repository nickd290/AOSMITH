import type { Part, Release, ReleaseShipment } from '@prisma/client'
import { prisma } from '@/lib/db'
import { EPG_DEFAULT_LBS_PER_PALLET } from '@/lib/epg'

export type ReleaseWithPart = Release & { part: Part }

export function shipmentTotals(
  pallets: number,
  boxes: number,
  part: Part,
): { totalUnits: number; cartons: number; weight: number } {
  const cartons = pallets * part.boxesPerPallet + boxes
  return {
    totalUnits: cartons * part.unitsPerBox,
    cartons,
    weight: Math.max(1, pallets) * EPG_DEFAULT_LBS_PER_PALLET,
  }
}

export function priorShippedUnits(
  shipments: ReleaseShipment[],
  beforeShipmentNumber: number,
): number {
  return shipments
    .filter((s) => s.shipmentNumber < beforeShipmentNumber)
    .reduce((sum, s) => sum + s.totalUnits, 0)
}

export function priorShippedPallets(
  shipments: ReleaseShipment[],
  beforeShipmentNumber: number,
): number {
  return shipments
    .filter((s) => s.shipmentNumber < beforeShipmentNumber)
    .reduce((sum, s) => sum + s.pallets, 0)
}

export async function ensureDefaultShipment(release: ReleaseWithPart): Promise<ReleaseShipment[]> {
  const existing = await prisma.releaseShipment.findMany({
    where: { releaseId: release.id },
    orderBy: { shipmentNumber: 'asc' },
  })

  if (existing.length > 0) {
    return existing
  }

  const totals = shipmentTotals(release.pallets, release.boxes, release.part)
  const created = await prisma.releaseShipment.create({
    data: {
      releaseId: release.id,
      shipmentNumber: 1,
      pallets: release.pallets,
      boxes: release.boxes,
      totalUnits: totals.totalUnits,
      cartons: totals.cartons,
      weight: totals.weight,
      status: 'PENDING',
    },
  })

  return [created]
}

export async function syncReleaseStatusFromShipments(releaseId: string): Promise<void> {
  const shipments = await prisma.releaseShipment.findMany({
    where: { releaseId },
  })

  if (shipments.length === 0) {
    return
  }

  const allShipped = shipments.every((s) => s.status === 'SHIPPED')
  const anyShipped = shipments.some((s) => s.status === 'SHIPPED')

  let status: 'COMPLETED' | 'PARTIALLY_SHIPPED' | 'SHIPPED' = 'COMPLETED'
  if (allShipped) {
    status = 'SHIPPED'
  } else if (anyShipped) {
    status = 'PARTIALLY_SHIPPED'
  }

  const shipped = shipments.filter((s) => s.status === 'SHIPPED')
  const latestShipped = [...shipped].sort(
    (a, b) => (b.shippedAt?.getTime() ?? 0) - (a.shippedAt?.getTime() ?? 0),
  )[0]

  await prisma.release.update({
    where: { id: releaseId },
    data: {
      status,
      ...(allShipped && latestShipped
        ? {
            proNumber: latestShipped.proNumber,
            trackingNumber: latestShipped.proNumber,
            shippedAt: latestShipped.shippedAt,
          }
        : {
            proNumber: null,
            trackingNumber: null,
            shippedAt: null,
          }),
    },
  })
}

export function validatePalletSplits(
  splits: number[],
  targetPallets: number,
): string | null {
  if (!splits.length) {
    return 'At least one shipment is required'
  }

  for (const n of splits) {
    if (!Number.isInteger(n) || n < 1) {
      return 'Each shipment must be at least 1 skid'
    }
  }

  const sum = splits.reduce((a, b) => a + b, 0)
  if (sum !== targetPallets) {
    return `Shipment skids must total ${targetPallets} (currently ${sum})`
  }

  return null
}