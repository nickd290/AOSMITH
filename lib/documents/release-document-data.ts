import type { Part, Release, ShippingLocation } from '@prisma/client'
import {
  EPG_DEFAULT_CARRIER,
  EPG_DEFAULT_FREIGHT_TERMS,
  EPG_DEFAULT_LBS_PER_PALLET,
  JD_SHIP_FROM,
} from '@/lib/epg'

export type ReleaseWithPartAndLocation = Release & {
  part: Part
  shippingLocation: ShippingLocation
}

export function releaseCartons(release: ReleaseWithPartAndLocation): number {
  return (
    release.cartons ??
    release.pallets * release.part.boxesPerPallet + release.boxes
  )
}

export function releaseTotalBoxes(release: ReleaseWithPartAndLocation): number {
  return release.pallets * release.part.boxesPerPallet + release.boxes
}

export function releaseWeightLbs(release: ReleaseWithPartAndLocation): number {
  if (release.weight && release.weight > 0) {
    return release.weight
  }
  return Math.max(1, release.pallets) * EPG_DEFAULT_LBS_PER_PALLET
}

export function weightForPalletCount(pallets: number): number {
  return Math.max(1, pallets) * EPG_DEFAULT_LBS_PER_PALLET
}

export function buildPackingSlipData(release: ReleaseWithPartAndLocation) {
  const shippingInstructions =
    [release.shippingLocation.instructions, release.notes]
      .filter(Boolean)
      .join(' | ') || undefined

  const cartons = releaseCartons(release)

  return {
    releaseNumber: release.releaseNumber,
    ticketNumber: release.ticketNumber || 'N/A',
    customerPONumber: release.customerPONumber,
    date: release.createdAt,
    shipTo: {
      name: release.shippingLocation.name,
      address: release.shippingLocation.address,
      city: release.shippingLocation.city,
      state: release.shippingLocation.state,
      zip: release.shippingLocation.zip,
      instructions: shippingInstructions,
    },
    shipFrom: {
      name: JD_SHIP_FROM.name,
      address: JD_SHIP_FROM.address,
      city: JD_SHIP_FROM.city,
      state: JD_SHIP_FROM.state,
      zip: JD_SHIP_FROM.zip,
      country: JD_SHIP_FROM.country,
    },
    lineItems: [
      {
        partNumber: release.part.partNumber,
        description: release.part.description,
        unitsPerBox: release.part.unitsPerBox,
        ordered: release.totalUnits,
        prevShip: 0,
        shipped: release.totalUnits,
        backOrdered: 0,
      },
    ],
    shipVia: release.shipVia || EPG_DEFAULT_CARRIER,
    freightTerms: release.freightTerms || EPG_DEFAULT_FREIGHT_TERMS,
    paymentTerms: release.paymentTerms || '2% 30, Net 60',
    cartons,
    weight: releaseWeightLbs(release),
    shippingClass: release.shippingClass || '55',
  }
}

export function buildBoxLabelData(release: ReleaseWithPartAndLocation) {
  return {
    partNumber: release.part.partNumber,
    description: release.part.description,
    unitsPerBox: release.part.unitsPerBox,
    batchNumber: release.batchNumber || 'N/A',
    manufactureDate: release.shipDate || release.createdAt,
    totalBoxes: releaseTotalBoxes(release),
  }
}