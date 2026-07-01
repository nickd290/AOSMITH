import type { Part, Release, ReleaseShipment, ShippingLocation } from '@prisma/client'
import {
  EPG_DEFAULT_CARRIER,
  EPG_DEFAULT_CARRIER_ACCOUNT,
  EPG_DEFAULT_FREIGHT_TERMS,
} from '@/lib/epg'
import type { LoadFlagSkid } from '@/lib/documents/load-flags'
import { priorShippedPallets, priorShippedUnits } from '@/lib/shipments/helpers'

export type ReleaseForPaperwork = Release & {
  part: Part
  shippingLocation: ShippingLocation
}

export function buildShipmentPaperworkContext(
  release: ReleaseForPaperwork,
  shipment: ReleaseShipment,
  allShipments: ReleaseShipment[],
) {
  const totalShipments = allShipments.length
  const prevUnits = priorShippedUnits(allShipments, shipment.shipmentNumber)
  const prevPallets = priorShippedPallets(allShipments, shipment.shipmentNumber)
  const remainingUnits = release.totalUnits - prevUnits - shipment.totalUnits
  const remainingPallets = release.pallets - prevPallets - shipment.pallets

  const cartons =
    shipment.cartons ??
    shipment.pallets * release.part.boxesPerPallet + shipment.boxes
  const weight = shipment.weight ?? 0

  return {
    releaseNumber: release.releaseNumber,
    ticketNumber: release.ticketNumber || 'N/A',
    customerPONumber: release.customerPONumber,
    date: release.createdAt,
    shipDate: shipment.shipDate ?? release.shipDate ?? null,
    carrier: shipment.carrier || release.carrier || EPG_DEFAULT_CARRIER,
    carrierAccountNumber:
      release.carrierAccountNumber || EPG_DEFAULT_CARRIER_ACCOUNT,
    freightTerms: release.freightTerms || EPG_DEFAULT_FREIGHT_TERMS,
    pallets: shipment.pallets,
    cartons,
    weight,
    shippingClass: release.shippingClass || '55',
    skidType: release.skidType,
    notes: release.notes,
    shipmentLabel: `Shipment ${shipment.shipmentNumber} of ${totalShipments} — ${shipment.pallets} of ${release.pallets} skids`,
    originalPallets: release.pallets,
    lineItems: [
      {
        partNumber: release.part.partNumber,
        description: release.part.description,
        unitsPerBox: release.part.unitsPerBox,
        ordered: release.totalUnits,
        shipped: shipment.totalUnits,
        prevShip: prevUnits,
        backOrdered: Math.max(0, remainingUnits),
      },
    ],
    remainingPallets,
    remainingUnits,
  }
}

export function buildLoadFlagsForShipment(
  release: ReleaseForPaperwork,
  shipment: ReleaseShipment,
  allShipments: ReleaseShipment[],
): {
  totalSkids: number
  totalWeight: number
  skids: LoadFlagSkid[]
  carrier: string
  customerPONumber: string
  shippingClass: string
  skidType: Release['skidType']
  batchNumber?: string
} {
  const ctx = buildShipmentPaperworkContext(release, shipment, allShipments)
  const palletCount = Math.max(1, shipment.pallets)
  const totalUnits = shipment.totalUnits
  const totalCartons = ctx.cartons
  const totalWeight = ctx.weight

  const baseUnits = Math.floor(totalUnits / palletCount)
  const baseCartons = Math.floor(totalCartons / palletCount)
  const baseWeight = Math.round((totalWeight / palletCount) * 100) / 100

  const skids: LoadFlagSkid[] = Array.from({ length: palletCount }, (_, i) => {
    const skidNumber = i + 1
    const isLast = skidNumber === palletCount
    return {
      skidNumber,
      partNumber: release.part.partNumber,
      description: release.part.description,
      unitsPerBox: release.part.unitsPerBox,
      units: isLast ? totalUnits - baseUnits * (palletCount - 1) : baseUnits,
      cartons: isLast
        ? totalCartons - baseCartons * (palletCount - 1)
        : baseCartons,
      weight: isLast
        ? Math.round((totalWeight - baseWeight * (palletCount - 1)) * 100) / 100
        : baseWeight,
    }
  })

  return {
    totalSkids: palletCount,
    totalWeight,
    skids,
    carrier: ctx.carrier,
    customerPONumber: release.customerPONumber,
    shippingClass: ctx.shippingClass,
    skidType: release.skidType,
    batchNumber: release.batchNumber ?? undefined,
  }
}