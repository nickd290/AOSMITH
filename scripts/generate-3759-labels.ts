/**
 * Generate box labels for Batch 3759 (EPG Knoxville inventory transfer)
 * Two parts, one pallet each (51 boxes per pallet)
 *
 * Usage: cd ~/inventory-release-app && npx tsx scripts/generate-3759-labels.ts
 */

import { generateBoxLabelsBuffer } from '../lib/documents/box-labels'
import * as fs from 'fs'
import * as path from 'path'

const BATCH_NUMBER = '3759'
const BOXES_PER_PALLET = 51
const OUTPUT_DIR = path.join(process.env.HOME || '~', 'Desktop')

const parts = [
  {
    partNumber: '100307705',
    description: 'MANUAL, 36 PAGE, RES, GAS, UNBRANDED',
    unitsPerBox: 130,
  },
  {
    partNumber: '100309797',
    description: 'MANUAL, 28 PAGE, RES, ELECT, UNBRANDED',
    unitsPerBox: 130,
  },
]

for (const part of parts) {
  console.log(`Generating ${BOXES_PER_PALLET} labels for part ${part.partNumber}...`)

  const buffer = generateBoxLabelsBuffer({
    partNumber: part.partNumber,
    description: part.description,
    unitsPerBox: part.unitsPerBox,
    batchNumber: BATCH_NUMBER,
    totalBoxes: BOXES_PER_PALLET,
    manufactureDate: new Date(),
  })

  const filename = `box-labels-${part.partNumber}-batch-${BATCH_NUMBER}.pdf`
  const outputPath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(outputPath, buffer)
  console.log(`  → Saved: ${outputPath}`)
}

console.log('\nDone! Two PDFs on your Desktop, ready to print.')
