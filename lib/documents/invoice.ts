import jsPDF from 'jspdf'
import * as fs from 'fs'
import * as path from 'path'
import { uploadInvoice, isR2Configured } from '../storage'

interface InvoiceData {
  invoiceNumber: string
  date: Date
  customerPONumber: string
  billTo: {
    name: string
    address: string
    city: string
    state: string
    zip: string
  }
  billFrom: {
    name: string
    address: string
    city: string
    state: string
    zip: string
  }
  lineItems: Array<{
    partNumber: string
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  paymentTerms: string
}

/**
 * Generate 8.5x11 invoice matching professional invoice format
 */
export function generateInvoice(data: InvoiceData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 8.5 x 11 inches
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40

  let currentY = margin

  // === HEADER SECTION ===
  // Invoice title (right side)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageWidth - margin, currentY, { align: 'right' })

  // Company name (left side)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(data.billFrom.name, margin, currentY)

  currentY += 25

  // Company address (left side)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.billFrom.address, margin, currentY)
  currentY += 14
  doc.text(`${data.billFrom.city}, ${data.billFrom.state} ${data.billFrom.zip}`, margin, currentY)

  // Invoice details (right side)
  let rightY = margin + 25
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - margin, rightY, { align: 'right' })
  rightY += 14
  const dateStr = data.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(`Date: ${dateStr}`, pageWidth - margin, rightY, { align: 'right' })

  currentY += 40

  // === BILL TO SECTION ===
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO:', margin, currentY)

  currentY += 18
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.billTo.name, margin, currentY)
  currentY += 14
  doc.text(data.billTo.address, margin, currentY)
  currentY += 14
  doc.text(`${data.billTo.city}, ${data.billTo.state} ${data.billTo.zip}`, margin, currentY)

  currentY += 30

  // Customer PO Number
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Customer PO #: ${data.customerPONumber}`, margin, currentY)

  currentY += 30

  // === LINE ITEMS TABLE ===
  // Table header background
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, currentY - 12, pageWidth - 2 * margin, 20, 'F')

  // Table headers
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)

  const colX = {
    partNumber: margin + 10,
    description: margin + 100,
    quantity: pageWidth - margin - 200,
    unitPrice: pageWidth - margin - 130,
    total: pageWidth - margin - 10,
  }

  doc.text('Part Number', colX.partNumber, currentY)
  doc.text('Description', colX.description, currentY)
  doc.text('Quantity', colX.quantity, currentY, { align: 'right' })
  doc.text('Unit Price', colX.unitPrice, currentY, { align: 'right' })
  doc.text('Total', colX.total, currentY, { align: 'right' })

  currentY += 20

  // Table header line
  doc.setLineWidth(1)
  doc.line(margin, currentY, pageWidth - margin, currentY)

  currentY += 18

  // Table rows
  doc.setFont('helvetica', 'normal')
  data.lineItems.forEach((item) => {
    // Check if we need a new page
    if (currentY > pageHeight - 150) {
      doc.addPage()
      currentY = margin
    }

    doc.text(item.partNumber, colX.partNumber, currentY)
    doc.text(item.description, colX.description, currentY)
    doc.text(item.quantity.toLocaleString(), colX.quantity, currentY, { align: 'right' })
    doc.text(`$${item.unitPrice.toFixed(4)}`, colX.unitPrice, currentY, { align: 'right' })
    doc.text(`$${item.total.toFixed(2)}`, colX.total, currentY, { align: 'right' })
    currentY += 20
  })

  // Bottom line
  currentY += 5
  doc.setLineWidth(1)
  doc.line(margin, currentY, pageWidth - margin, currentY)

  currentY += 25

  // === TOTALS SECTION ===
  const totalsX = pageWidth - margin - 150

  // Subtotal
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', totalsX, currentY)
  doc.text(`$${data.subtotal.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' })
  currentY += 16

  // Tax
  if (data.tax > 0) {
    doc.text('Tax:', totalsX, currentY)
    doc.text(`$${data.tax.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' })
    currentY += 16
  }

  // Total
  currentY += 5
  doc.setLineWidth(2)
  doc.line(totalsX - 10, currentY - 5, pageWidth - margin, currentY - 5)

  currentY += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', totalsX, currentY)
  doc.text(`$${data.total.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' })

  // === PAYMENT TERMS SECTION ===
  currentY = pageHeight - 120

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Terms:', margin, currentY)
  currentY += 16
  doc.setFont('helvetica', 'normal')
  doc.text(data.paymentTerms, margin, currentY)

  // === FOOTER ===
  currentY = pageHeight - 60

  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  const thankYou = 'Thank you for your business!'
  doc.text(thankYou, pageWidth / 2, currentY, { align: 'center' })

  currentY += 14
  const remittance = 'Please remit payment to the address above.'
  doc.text(remittance, pageWidth / 2, currentY, { align: 'center' })

  return doc
}

/**
 * Save invoice PDF to R2 cloud storage (or local filesystem as fallback)
 */
export async function saveInvoice(
  releaseId: string,
  data: InvoiceData
): Promise<string> {
  const doc = generateInvoice(data)
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  // Use R2 cloud storage if configured, otherwise fall back to local filesystem
  if (isR2Configured()) {
    try {
      const url = await uploadInvoice(pdfBuffer, releaseId)
      return url
    } catch (error) {
      console.error('Failed to upload to R2, falling back to local storage:', error)
      // Fall through to local storage
    }
  }

  // Local filesystem fallback (for development or if R2 is not configured)
  const fileName = `invoice.pdf`
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
 * Get full file system path for invoice (for email attachments)
 */
export function getInvoiceFilePath(releaseId: string): string {
  return path.join(process.cwd(), 'public', 'documents', 'releases', releaseId, 'invoice.pdf')
}
