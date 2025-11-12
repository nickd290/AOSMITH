import jsPDF from 'jspdf'
import { generateBarcodeWithValue } from './barcode'
import { uploadBoxLabels, isR2Configured } from '../storage'

interface BoxLabelData {
  partNumber: string
  description: string
  unitsPerBox: number
  batchNumber: string
  manufactureDate: Date
  totalBoxes: number
}

/**
 * Generate 4x6 inch box labels with 2x3 grid layout
 * Matches the format from 100307705.pdf and 100309797.pdf samples
 */
export function generateBoxLabels(data: BoxLabelData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: [4, 6], // 4x6 inch labels
  })

  // Generate one label per box
  for (let boxNum = 1; boxNum <= data.totalBoxes; boxNum++) {
    if (boxNum > 1) {
      doc.addPage([4, 6])
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
  const pageWidth = 4
  const pageHeight = 6
  const margin = 0.1
  const cellWidth = (pageWidth - 2 * margin) / 2
  const cellHeight = (pageHeight - 2 * margin) / 3

  // Draw grid lines (bolder to match sample)
  doc.setLineWidth(0.025)
  doc.setDrawColor(0, 0, 0)

  // Vertical line
  doc.line(pageWidth / 2, margin, pageWidth / 2, pageHeight - margin)

  // Horizontal lines
  doc.line(margin, margin + cellHeight, pageWidth - margin, margin + cellHeight)
  doc.line(
    margin,
    margin + 2 * cellHeight,
    pageWidth - margin,
    margin + 2 * cellHeight
  )

  // === TOP LEFT: Company Address ===
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const addressX = margin + 0.1
  let addressY = margin + 0.2

  doc.text('Enterprise Print Group', addressX, addressY)
  addressY += 0.15
  doc.text('6234 Enterprise Drive', addressX, addressY)
  addressY += 0.15
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
    fontSize: 11,
  })

  // Add barcode image
  doc.addImage(quantityBarcode, 'PNG', topRightX, topRightY + 0.1, 1.6, 0.6)

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
    fontSize: 11,
  })

  doc.addImage(partBarcode, 'PNG', midLeftX, midLeftY + 0.1, 1.6, 0.6)

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
    fontSize: 11,
  })

  doc.addImage(batchBarcode, 'PNG', midRightX, midRightY + 0.1, 1.6, 0.6)

  // === BOTTOM LEFT: Description ===
  const bottomLeftX = margin + 0.1
  let bottomLeftY = margin + 2 * cellHeight + 0.2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', bottomLeftX, bottomLeftY)

  bottomLeftY += 0.15
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  // Split description if too long (convert to uppercase to match sample)
  const descLines = doc.splitTextToSize(data.description.toUpperCase(), cellWidth * 2 - 0.2)
  doc.text(descLines, bottomLeftX, bottomLeftY)

  // === BOTTOM RIGHT: Manufacture Date ===
  const bottomRightX = pageWidth / 2 + 0.1
  let bottomRightY = margin + 2 * cellHeight + 0.2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Date of Manufacture', bottomRightX, bottomRightY)

  bottomRightY += 0.15
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const dateStr = data.manufactureDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  doc.text(dateStr, bottomRightX, bottomRightY)
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
