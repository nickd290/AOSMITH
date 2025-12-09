import jsPDF from 'jspdf'
import { generateBarcode } from './barcode'
import * as fs from 'fs'
import * as path from 'path'
import { uploadPackingSlip, isR2Configured } from '../storage'

interface PackingSlipData {
  releaseNumber: string
  ticketNumber: string
  customerPONumber: string
  date: Date
  shipTo: {
    name: string
    address: string
    city: string
    state: string
    zip: string
  }
  shipFrom: {
    name: string
    address: string
    city: string
    state: string
    zip: string
    country: string
  }
  lineItems: Array<{
    partNumber: string
    description: string
    unitsPerBox: number
    ordered: number
    prevShip: number
    shipped: number
    backOrdered: number
  }>
  shipVia: string
  freightTerms: string
  paymentTerms: string
  cartons: number
  weight: number
  shippingClass: string
}

/**
 * Generate 8.5x11 packing slip matching PS 13844 SAMPLE.pdf format
 */
export function generatePackingSlip(data: PackingSlipData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 8.5 x 11 inches
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40

  // === HEADER SECTION ===
  let currentY = margin

  // EPG Logo (left side)
  const logoPath = path.join(process.cwd(), 'public', 'images', 'epg-logo.jpg')
  let logoWidth = 0
  if (fs.existsSync(logoPath)) {
    try {
      const logoData = fs.readFileSync(logoPath)
      const logoBase64 = logoData.toString('base64')
      const logoDataUrl = `data:image/jpeg;base64,${logoBase64}`
      // Logo dimensions - wider format to match EPG branding
      logoWidth = 150
      const logoHeight = 45
      doc.addImage(logoDataUrl, 'JPEG', margin, currentY, logoWidth, logoHeight)
    } catch (e) {
      console.error('Failed to load logo:', e)
      logoWidth = 0
    }
  }

  // Company contact info (below logo or at top if no logo)
  const contactY = logoWidth > 0 ? currentY + 50 : currentY + 15
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  const contactInfo = 'P.O. Box 52870 | Knoxville, TN 37950 | 865-219-5587 | www.eprintgroup.com'
  doc.text(contactInfo, margin, contactY)
  doc.setTextColor(0, 0, 0)

  // Document title (right side)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Packing Slip / Bill of Lading', pageWidth - margin, currentY, {
    align: 'right',
  })

  currentY += 20
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Page 1`, pageWidth - margin, currentY, { align: 'right' })

  currentY += 15
  const dateStr = data.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  doc.text(dateStr, pageWidth - margin, currentY, { align: 'right' })

  currentY = margin + 80

  // === DOCUMENT NUMBERS SECTION ===
  // Packing Slip Number with barcode
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Packing Slip No. ${data.releaseNumber}`, margin, currentY)

  // Generate barcode for packing slip number
  const packingSlipBarcode = generateBarcode(data.releaseNumber, {
    width: 1,
    height: 30,
    displayValue: false,
  })
  doc.addImage(packingSlipBarcode, 'PNG', margin + 150, currentY - 10, 80, 20)

  // Ticket Number
  currentY += 25
  doc.text(`Ticket No. ${data.ticketNumber}`, margin, currentY)

  currentY += 30

  // === SHIPPING ADDRESSES SECTION ===
  const columnWidth = (pageWidth - 2 * margin) / 2

  // To: (left column)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('To:', margin, currentY)

  currentY += 15
  doc.setFont('helvetica', 'normal')
  doc.text(data.shipTo.name, margin, currentY)
  currentY += 12
  doc.text(data.shipTo.address, margin, currentY)
  currentY += 12
  doc.text(`${data.shipTo.city}, ${data.shipTo.state} ${data.shipTo.zip}`, margin, currentY)

  // From: (right column)
  let fromY = currentY - 39
  doc.setFont('helvetica', 'bold')
  doc.text('From:', margin + columnWidth, fromY)

  fromY += 15
  doc.setFont('helvetica', 'normal')
  doc.text(data.shipFrom.name, margin + columnWidth, fromY)
  fromY += 12
  doc.text(data.shipFrom.address, margin + columnWidth, fromY)
  fromY += 12
  doc.text(`${data.shipFrom.city}, ${data.shipFrom.state} ${data.shipFrom.zip}`, margin + columnWidth, fromY)
  fromY += 12
  doc.text(data.shipFrom.country, margin + columnWidth, fromY)

  currentY += 40

  // === PURCHASE ORDER ===
  doc.setFont('helvetica', 'bold')
  doc.text(`PO No.: ${data.customerPONumber}`, margin, currentY)

  currentY += 25

  // === SHIPPING DETAILS ===
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`SHIP VIA: ${data.shipVia}`, pageWidth / 2, currentY, { align: 'center' })

  currentY += 18
  doc.setFontSize(14)
  doc.text('MAY SHIP EARLY', pageWidth / 2, currentY, { align: 'center' })

  currentY += 30

  // === LINE ITEMS TABLE ===
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')

  // Table headers
  const colWidths = [80, 200, 60, 60, 60, 75]
  const colX = [
    margin,
    margin + colWidths[0],
    margin + colWidths[0] + colWidths[1],
    margin + colWidths[0] + colWidths[1] + colWidths[2],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
  ]

  doc.text('Part Number', colX[0], currentY)
  doc.text('Description', colX[1], currentY)
  doc.text('Ordered', colX[2], currentY)
  doc.text('Prev Ship', colX[3], currentY)
  doc.text('Shipped', colX[4], currentY)
  doc.text('Back ordered', colX[5], currentY)

  // Header line
  currentY += 5
  doc.line(margin, currentY, pageWidth - margin, currentY)

  currentY += 15

  // Table rows
  doc.setFont('helvetica', 'normal')
  data.lineItems.forEach((item) => {
    doc.text(item.partNumber, colX[0], currentY)
    // Add units/box notation to description to match sample
    const descWithUnits = `${item.description}\n${item.unitsPerBox}/BOX`
    const descLines = doc.splitTextToSize(descWithUnits, colWidths[1] - 10)
    doc.text(descLines, colX[1], currentY)
    doc.text(item.ordered.toLocaleString(), colX[2], currentY)
    doc.text(item.prevShip.toLocaleString(), colX[3], currentY)
    doc.text(item.shipped.toLocaleString(), colX[4], currentY)
    doc.text(item.backOrdered.toLocaleString(), colX[5], currentY)
    currentY += 25
  })

  // Bottom line
  doc.line(margin, currentY, pageWidth - margin, currentY)

  currentY += 30

  // === NOTES SECTION ===
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  const certText =
    'Enterprise Print Group certifies that the above order was produced to the required manufacturing and material specifications.'
  doc.text(certText, margin, currentY, { maxWidth: pageWidth - 2 * margin })

  // === FOOTER SECTION ===
  currentY = pageHeight - 150

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  // Left column
  doc.text(`FREIGHT: ${data.freightTerms}`, margin, currentY)
  currentY += 15
  doc.text(`Cartons: ${data.cartons}`, margin, currentY)
  currentY += 15
  doc.text(`Weight: ${data.weight} lbs.`, margin, currentY)
  currentY += 15
  doc.text(`Shipping Class: ${data.shippingClass}`, margin, currentY)

  // Right column
  let rightY = currentY - 45
  doc.text(`Freight Acct. No.`, margin + columnWidth, rightY)
  rightY += 15
  doc.text(`Payment terms: ${data.paymentTerms}`, margin + columnWidth, rightY)

  // Signature line
  currentY = pageHeight - 80
  doc.line(margin, currentY, margin + 200, currentY)
  currentY += 12
  doc.setFontSize(8)
  doc.text('Signature', margin, currentY)

  doc.line(margin + 250, currentY - 12, margin + 400, currentY - 12)
  doc.text('Date', margin + 250, currentY)

  return doc
}

/**
 * Save packing slip PDF to R2 cloud storage (or local filesystem as fallback)
 */
export async function savePackingSlip(
  releaseId: string,
  data: PackingSlipData
): Promise<string> {
  const doc = generatePackingSlip(data)
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  // Use R2 cloud storage if configured, otherwise fall back to local filesystem
  if (isR2Configured()) {
    try {
      const url = await uploadPackingSlip(pdfBuffer, data.releaseNumber)
      return url
    } catch (error) {
      console.error('Failed to upload to R2, falling back to local storage:', error)
      // Fall through to local storage
    }
  }

  // Local filesystem fallback (for development or if R2 is not configured)
  const fileName = `packing-slip.pdf`
  const filePath = `/documents/releases/${releaseId}/${fileName}`
  const fullPath = path.join(process.cwd(), 'public', filePath)

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
 * Get full file system path for packing slip (for email attachments)
 */
export function getPackingSlipFilePath(releaseId: string): string {
  return path.join(process.cwd(), 'public', 'documents', 'releases', releaseId, 'packing-slip.pdf')
}
