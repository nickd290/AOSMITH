/**
 * Generate box labels for PO 3925 (1-off custom job)
 *
 * Usage: cd ~/inventory-release-app && npx tsx scripts/generate-3925-labels.ts [totalBoxes]
 */

import { generateBoxLabelsBuffer } from '../lib/documents/box-labels'
import * as fs from 'fs'
import * as path from 'path'

const BATCH_NUMBER = '3925'
const TOTAL_BOXES = parseInt(process.argv[2] || '1', 10)
const OUTPUT_DIR = path.join(process.env.HOME || '~', 'Desktop')

const part = {
  partNumber: '1000401844',
  description: 'MANUAL 116PG S410,60-119,BTH,COM,GEN,EN-US 40/BOX',
  unitsPerBox: 40,
}

console.log(`Generating ${TOTAL_BOXES} label(s) for part ${part.partNumber} / PO ${BATCH_NUMBER}...`)

const buffer = generateBoxLabelsBuffer({
  partNumber: part.partNumber,
  description: part.description,
  unitsPerBox: part.unitsPerBox,
  batchNumber: BATCH_NUMBER,
  totalBoxes: TOTAL_BOXES,
  manufactureDate: new Date(2026, 3, 20), // 04/20/2026
})

const filename = `box-labels-${part.partNumber}-po-${BATCH_NUMBER}.pdf`
const outputPath = path.join(OUTPUT_DIR, filename)
fs.writeFileSync(outputPath, buffer)
console.log(`  → Saved: ${outputPath}`)
