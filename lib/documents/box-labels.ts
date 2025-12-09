import jsPDF from 'jspdf'
import { generateBarcodeWithValue } from './barcode'
import { uploadBoxLabels, isR2Configured } from '../storage'

interface BoxLabelData {
  partNumber: string
  description: string
  unitsPerBox: number
  batchNumber: string
  shipDate: Date
  etaDeliveryDate?: Date | null
  totalBoxes: number
}

/**
 * Generate 4x6 inch box labels in LANDSCAPE orientation (6" wide x 4" tall)
 * Standard thermal label format for shipping labels
 */
export function generateBoxLabels(data: BoxLabelData): jsPDF {
  // Create 4x6 label in landscape orientation (6" wide x 4" tall)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [4, 6], // 4x6 label stock, landscape makes it 6" wide x 4" tall
  })

  // Generate one label per box
  for (let boxNum = 1; boxNum <= data.totalBoxes; boxNum++) {
    if (boxNum > 1) {
      doc.addPage([4, 6], 'landscape')
    }

    generateSingleBoxLabel(doc, data, boxNum)
  }

  return doc
}

function generateSingleBoxLabel(
  doc: jsPDF,
  data: BoxLabelData,
  boxNumber: number
): void {
  // 6" wide x 4" tall
  const pageWidth = 6
  const pageHeight = 4
  const margin = 0.2
  const cellWidth = (pageWidth - 2 * margin) / 2
  const cellHeight = (pageHeight - 2 * margin) / 3

  // Draw grid lines
  doc.setLineWidth(0.015)
  doc.setDrawColor(0, 0, 0)

  // Outer border
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin)

  // Vertical line (center)
  doc.line(pageWidth / 2, margin, pageWidth / 2, pageHeight - margin)

  // Horizontal lines
  doc.line(margin, margin + cellHeight, pageWidth - margin, margin + cellHeight)
  doc.line(margin, margin + 2 * cellHeight, pageWidth - margin, margin + 2 * cellHeight)

  // === TOP LEFT: Company Address ===
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const addressX = margin + 0.1
  let addressY = margin + 0.25

  doc.text('Enterprise Print Group', addressX, addressY)
  addressY += 0.16
  doc.text('6234 Enterprise Drive', addressX, addressY)
  addressY += 0.16
  doc.text('Knoxville, TN 37909', addressX, addressY)

  // === TOP RIGHT: Box Quantity ===
  const topRightX = pageWidth / 2 + 0.1
  let topRightY = margin + 0.2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Box Quantity', topRightX, topRightY)

  // Generate barcode for quantity
  const quantityBarcode = generateBarcodeWithValue(data.unitsPerBox.toString(), {
    width: 1.5,
    height: 40,
    fontSize: 12,
  })

  doc.addImage(quantityBarcode, 'PNG', topRightX, topRightY + 0.05, 2.0, 0.55)

  // === MIDDLE LEFT: Part Number ===
  const midLeftX = margin + 0.1
  let midLeftY = margin + cellHeight + 0.2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Part #', midLeftX, midLeftY)

  // Generate barcode for part number
  const partBarcode = generateBarcodeWithValue(data.partNumber, {
    width: 1.5,
    height: 40,
    fontSize: 12,
  })

  doc.addImage(partBarcode, 'PNG', midLeftX, midLeftY + 0.05, 2.0, 0.55)

  // === MIDDLE RIGHT: Batch Number ===
  const midRightX = pageWidth / 2 + 0.1
  let midRightY = margin + cellHeight + 0.2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Batch #', midRightX, midRightY)

  // Generate barcode for batch number
  const batchBarcode = generateBarcodeWithValue(data.batchNumber, {
    width: 1.5,
    height: 40,
    fontSize: 12,
  })

  doc.addImage(batchBarcode, 'PNG', midRightX, midRightY + 0.05, 2.0, 0.55)

  // === BOTTOM LEFT: Description ===
  const bottomLeftX = margin + 0.1
  let bottomLeftY = margin + 2 * cellHeight + 0.2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', bottomLeftX, bottomLeftY)

  bottomLeftY += 0.18
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  // Split description if too long (convert to uppercase to match sample)
  const descLines = doc.splitTextToSize(data.description.toUpperCase(), cellWidth - 0.3)
  doc.text(descLines, bottomLeftX, bottomLeftY)

  // === BOTTOM RIGHT: Ship Date & ETA ===
  const bottomRightX = pageWidth / 2 + 0.1
  let bottomRightY = margin + 2 * cellHeight + 0.18

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Ship Date:', bottomRightX, bottomRightY)

  doc.setFont('helvetica', 'normal')
  const shipDateStr = data.shipDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  doc.text(shipDateStr, bottomRightX + 0.7, bottomRightY)

  // Show ETA Delivery Date
  if (data.etaDeliveryDate) {
    bottomRightY += 0.25
    doc.setFont('helvetica', 'bold')
    doc.text('ETA Delivery:', bottomRightX, bottomRightY)

    doc.setFont('helvetica', 'normal')
    const etaDateStr = data.etaDeliveryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    doc.text(etaDateStr, bottomRightX + 0.9, bottomRightY)
  }
}

/**
 * Generate box labels PDF and return as Buffer (for email attachments)
 */
export function generateBoxLabelsBuffer(data: BoxLabelData): Buffer {
  const doc = generateBoxLabels(data)
  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * Save box labels PDF to R2 cloud storage (or local filesystem as fallback)
 */
export async function saveBoxLabels(
  releaseId: string,
  data: BoxLabelData
): Promise<string> {
  const doc = generateBoxLabels(data)
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  // Use R2 cloud storage if configured, otherwise fall back to local filesystem
  if (isR2Configured()) {
    try {
      const url = await uploadBoxLabels(pdfBuffer, releaseId)
      return url
    } catch (error) {
      console.error('Failed to upload to R2, falling back to local storage:', error)
      // Fall through to local storage
    }
  }

  // Local filesystem fallback (for development or if R2 is not configured)
  const fs = require('fs')
  const path = require('path')
  const fileName = `box-labels.pdf`
  const filePath = `/documents/releases/${releaseId}/${fileName}`
  const fullPath = `public${filePath}`

  // Create directory if it doesn't exist
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Save PDF
  fs.writeFileSync(fullPath, pdfBuffer)

  return filePath
}

/**
 * Get full file system path for box labels (for email attachments)
 */
export function getBoxLabelsFilePath(releaseId: string): string {
  const path = require('path')
  return path.join(process.cwd(), 'public', 'documents', 'releases', releaseId, 'box-labels.pdf')
}
