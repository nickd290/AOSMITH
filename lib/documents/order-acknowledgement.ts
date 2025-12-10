import jsPDF from 'jspdf'

interface OrderAcknowledgementData {
  orderNumber: string
  date: Date
  customerPONumber: string
  shipDate: Date
  etaDeliveryDate?: Date | null
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
  }
  lineItems: Array<{
    partNumber: string
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  total: number
  paymentTerms: string
}

/**
 * Generate 8.5x11 Order Acknowledgement document
 */
export function generateOrderAcknowledgement(data: OrderAcknowledgementData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40

  let currentY = margin

  // === HEADER SECTION ===
  // Title (right side)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDER ACKNOWLEDGEMENT', pageWidth - margin, currentY, { align: 'right' })

  // Company name (left side)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(data.shipFrom.name, margin, currentY)

  currentY += 25

  // Company address (left side)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.shipFrom.address, margin, currentY)
  currentY += 14
  doc.text(`${data.shipFrom.city}, ${data.shipFrom.state} ${data.shipFrom.zip}`, margin, currentY)

  // Order details (right side)
  let rightY = margin + 25
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Order #: ${data.orderNumber}`, pageWidth - margin, rightY, { align: 'right' })
  rightY += 14
  const dateStr = data.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(`Date: ${dateStr}`, pageWidth - margin, rightY, { align: 'right' })

  currentY += 40

  // === SHIP TO SECTION ===
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('SHIP TO:', margin, currentY)

  currentY += 18
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.shipTo.name, margin, currentY)
  currentY += 14
  doc.text(data.shipTo.address, margin, currentY)
  currentY += 14
  doc.text(`${data.shipTo.city}, ${data.shipTo.state} ${data.shipTo.zip}`, margin, currentY)

  currentY += 30

  // Customer PO Number and Ship Date
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Customer PO #: ${data.customerPONumber}`, margin, currentY)

  // Ship Date on the right
  const shipDateStr = data.shipDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(`Ship Date: ${shipDateStr}`, pageWidth - margin - 150, currentY)

  currentY += 18

  // ETA Delivery Date if available
  if (data.etaDeliveryDate) {
    const etaStr = data.etaDeliveryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    doc.text(`ETA Delivery: ${etaStr}`, pageWidth - margin - 150, currentY)
    currentY += 18
  }

  currentY += 20

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

  // Total
  doc.setLineWidth(2)
  doc.line(totalsX - 10, currentY - 5, pageWidth - margin, currentY - 5)

  currentY += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDER TOTAL:', totalsX, currentY)
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
  doc.text('Thank you for your order!', pageWidth / 2, currentY, { align: 'center' })

  currentY += 14
  doc.text('Invoice will be sent on ship date.', pageWidth / 2, currentY, { align: 'center' })

  return doc
}

/**
 * Generate Order Acknowledgement PDF and return as Buffer (for email attachments)
 */
export function generateOrderAcknowledgementBuffer(data: OrderAcknowledgementData): Buffer {
  const doc = generateOrderAcknowledgement(data)
  return Buffer.from(doc.output('arraybuffer'))
}
