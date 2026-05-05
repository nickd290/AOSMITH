/**
 * Batch 3930 — EPG/AO Smith one-off paperwork (XPO carrier).
 * Two parts, one pallet each (51 boxes × 130 units = 6,630 pieces per book).
 *
 * Outputs to ~/Desktop:
 *   - box-labels-100307705-batch-3930.pdf  (51 labels)
 *   - box-labels-100309797-batch-3930.pdf  (51 labels)
 *   - bol-batch-3930.pdf                   (JD packing slip + BOL)
 *   - load-flags-batch-3930.pdf
 *
 * Usage: cd ~/inventory-release-app && npx tsx scripts/generate-3930-paperwork.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { generateBoxLabelsBuffer } from '../lib/documents/box-labels'
import { generateJdShipmentPaperworkBuffer } from '../lib/documents/jd-shipment-paperwork'
import { generateLoadFlagsBuffer } from '../lib/documents/load-flags'

const BATCH_NUMBER = '3930'
const BOXES_PER_PALLET = 51
const UNITS_PER_BOX = 130
const UNITS_PER_PALLET = BOXES_PER_PALLET * UNITS_PER_BOX // 6,630
const SKID_WEIGHT = 990
const SHIPPING_CLASS = '55'
const CARRIER = 'XPO'
const OUTPUT_DIR = path.join(process.env.HOME || '~', 'Desktop')
const TODAY = new Date()

const parts = [
  {
    partNumber: '100307705',
    description: 'MANUAL, 36 PAGE, RES, GAS, UNBRANDED',
    unitsPerBox: UNITS_PER_BOX,
  },
  {
    partNumber: '100309797',
    description: 'MANUAL, 28 PAGE, RES, ELECT, UNBRANDED',
    unitsPerBox: UNITS_PER_BOX,
  },
]

// 1. Box labels — one PDF per part, 51 labels each
for (const part of parts) {
  console.log(`Generating ${BOXES_PER_PALLET} box labels for ${part.partNumber}...`)
  const buf = generateBoxLabelsBuffer({
    partNumber: part.partNumber,
    description: part.description,
    unitsPerBox: part.unitsPerBox,
    batchNumber: BATCH_NUMBER,
    totalBoxes: BOXES_PER_PALLET,
    manufactureDate: TODAY,
  })
  const filename = `box-labels-${part.partNumber}-batch-${BATCH_NUMBER}.pdf`
  const outPath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(outPath, buf)
  console.log(`  → ${outPath}`)
}

// 2. JD packing slip + BOL (single 2-page PDF, both line items)
console.log('Generating JD packing slip + BOL...')
const totalCartons = BOXES_PER_PALLET * parts.length
const totalPallets = parts.length
const totalWeight = SKID_WEIGHT * parts.length

const bolBuf = generateJdShipmentPaperworkBuffer({
  releaseNumber: `EPG-${BATCH_NUMBER}`,
  ticketNumber: BATCH_NUMBER,
  customerPONumber: BATCH_NUMBER,
  date: TODAY,
  shipDate: null,
  carrier: CARRIER,
  carrierAccountNumber: 'JDGRCCTS900', // JD Graphic XPO customer #
  freightTerms: 'Prepaid',
  pallets: totalPallets,
  cartons: totalCartons,
  weight: totalWeight,
  shippingClass: SHIPPING_CLASS,
  skidType: 'WOOD',
  notes: `MAY SHIP EARLY\nPO #: ${BATCH_NUMBER}\nBatch #: ${BATCH_NUMBER}`,
  lineItems: parts.map((p) => ({
    partNumber: p.partNumber,
    description: p.description,
    unitsPerBox: p.unitsPerBox,
    ordered: UNITS_PER_PALLET,
    shipped: UNITS_PER_PALLET,
  })),
  perSkidLineItems: parts.map((p, i) => ({
    skidNumber: i + 1,
    cartons: BOXES_PER_PALLET,
    weight: SKID_WEIGHT,
    partNumber: p.partNumber,
    description: p.description,
    unitsPerBox: p.unitsPerBox,
    units: UNITS_PER_PALLET,
  })),
})
const bolPath = path.join(OUTPUT_DIR, `bol-batch-${BATCH_NUMBER}.pdf`)
fs.writeFileSync(bolPath, bolBuf)
console.log(`  → ${bolPath}`)

// 3. Load flag — one sheet covering both skids
console.log('Generating load flag...')
const loadBuf = generateLoadFlagsBuffer({
  releaseNumber: `BATCH-${BATCH_NUMBER}`,
  date: TODAY,
  carrier: CARRIER,
  customerPONumber: BATCH_NUMBER,
  batchNumber: BATCH_NUMBER,
  totalSkids: totalPallets,
  totalWeight,
  shippingClass: SHIPPING_CLASS,
  skidType: 'WOOD',
  skids: parts.map((p, i) => ({
    skidNumber: i + 1,
    partNumber: p.partNumber,
    description: p.description,
    units: UNITS_PER_PALLET,
    cartons: BOXES_PER_PALLET,
    unitsPerBox: p.unitsPerBox,
    weight: SKID_WEIGHT,
  })),
})
const loadPath = path.join(OUTPUT_DIR, `load-flags-batch-${BATCH_NUMBER}.pdf`)
fs.writeFileSync(loadPath, loadBuf)
console.log(`  → ${loadPath}`)

console.log('\nDone. Four PDFs on your Desktop, ready to print.')
