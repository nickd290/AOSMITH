/**
 * Preview the JD shipment paperwork PDF without touching the database.
 *
 * Usage:
 *   npx tsx scripts/preview-jd-paperwork.ts
 *
 * Writes to /tmp/jd-paperwork-preview.pdf using a fake release based on the
 * REL-20260420-0032 pattern (28-page electric manual, 5 pallets, 33,150 units).
 */

import * as fs from 'fs'
import { generateJdShipmentPaperworkBuffer } from '../lib/documents/jd-shipment-paperwork'

const buf = generateJdShipmentPaperworkBuffer({
  releaseNumber: 'REL-20260425-0033',
  ticketNumber: 'TKT-00033',
  customerPONumber: '4502959706',
  date: new Date('2026-04-25'),
  shipDate: new Date('2026-05-04'),
  carrier: 'FedEx Freight',
  freightTerms: 'Prepaid',
  pallets: 5,
  cartons: 340,
  weight: 6800,
  shippingClass: '55',
  skidType: 'WOOD',
  notes: null,
  lineItems: [
    {
      partNumber: '100309797',
      description: 'MANUAL 28 PAGE, RES, ELECT, UNBRANDED',
      unitsPerBox: 97,
      ordered: 33150,
      shipped: 33150,
    },
  ],
})

const out = '/tmp/jd-paperwork-preview.pdf'
fs.writeFileSync(out, buf)
console.log(`✓ Wrote ${out} (${buf.length.toLocaleString()} bytes)`)
console.log(`Open with: open ${out}`)
