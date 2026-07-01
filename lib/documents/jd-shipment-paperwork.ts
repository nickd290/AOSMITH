/**
 * JD Graphic shipment paperwork — packing slip + BOL combo.
 *
 * Per Apr 2026 EPG new process: JD ships EPG releases on JD's own paperwork
 * (XPO, JD account JDGRCCTS900). EPG no longer uploads anything. Page 1 = JD
 * packing slip. Page 2 = BOL pre-filled with XPO + account #, blank PRO# for
 * shipping party to fill in after phone booking the pickup.
 */

import jsPDF from 'jspdf'
import * as fs from 'fs'
import * as path from 'path'
import { generateBarcode } from './barcode'
import { EPG_SHIP_TO, JD_SHIP_FROM } from '../epg'

interface LineItem {
  partNumber: string
  description: string
  unitsPerBox: number
  ordered: number
  shipped: number
  prevShip?: number
  backOrdered?: number
}

type SkidTypeValue = 'WOOD' | 'HEAT_TREATED'

function formatSkidType(value: SkidTypeValue): string {
  return value === 'HEAT_TREATED' ? 'HEAT-TREATED' : 'WOOD'
}

interface JdShipmentPaperworkData {
  releaseNumber: string
  ticketNumber: string
  customerPONumber: string
  date: Date
  shipDate: Date | null
  carrier: string // default 'XPO'
  carrierAccountNumber?: string | null // e.g. 'JDGRCCTS900' for XPO
  freightTerms: string // 'Prepaid' (JD pays)
  pallets: number
  cartons: number
  weight: number
  shippingClass: string
  skidType: SkidTypeValue
  notes?: string | null
  lineItems: LineItem[]
  perSkidLineItems?: Array<{
    skidNumber: number
    cartons: number
    weight: number
    partNumber: string
    description: string
    unitsPerBox: number
    units: number
  }>
  shipmentLabel?: string
  originalPallets?: number
}

const JD_BLUE: [number, number, number] = [26, 30, 46] // #1a1e2e per JD brand
const ACCENT_ORANGE: [number, number, number] = [196, 90, 44] // #c45a2c per JD brand

function tryLoadLogo(filename: string): string | null {
  const logoPath = path.join(process.cwd(), 'public', 'images', filename)
  if (!fs.existsSync(logoPath)) return null
  try {
    const data = fs.readFileSync(logoPath)
    return `data:image/${filename.endsWith('.png') ? 'png' : 'jpeg'};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}

function drawJdHeader(doc: jsPDF, pageWidth: number, margin: number, title: string): number {
  let y = margin

  // JD Logo (left). Falls back to text wordmark if PNG/JPG missing.
  const logo = tryLoadLogo('jd-logo.png') ?? tryLoadLogo('jd-logo.jpg')
  if (logo) {
    try {
      doc.addImage(logo, logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', margin, y, 130, 40)
    } catch {
      // continue silently — fall through to wordmark
    }
  }

  if (!logo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...JD_BLUE)
    doc.text('JD GRAPHIC', margin, y + 22)
    doc.setTextColor(0, 0, 0)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text(
    `${JD_SHIP_FROM.address} | ${JD_SHIP_FROM.city}, ${JD_SHIP_FROM.state} ${JD_SHIP_FROM.zip} | ${JD_SHIP_FROM.phone} | ${JD_SHIP_FROM.email}`,
    margin,
    y + 50,
  )
  doc.setTextColor(0, 0, 0)

  // Document title (right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...JD_BLUE)
  doc.text(title, pageWidth - margin, y + 18, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  return y + 70
}

function drawAddressBlock(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  block: { name: string; address: string; city: string; state: string; zip: string },
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'normal')
  let cy = y + 14
  doc.text(block.name, x, cy)
  cy += 12
  doc.text(block.address, x, cy)
  cy += 12
  doc.text(`${block.city}, ${block.state} ${block.zip}`, x, cy)
  return cy
}

function drawPackingSlipPage(doc: jsPDF, data: JdShipmentPaperworkData): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = drawJdHeader(doc, pageWidth, margin, 'PACKING SLIP')

  // Document refs
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Packing Slip No. ${data.releaseNumber}`, margin, y)

  // Barcode for the release number
  try {
    const barcode = generateBarcode(data.releaseNumber, { width: 1, height: 26, displayValue: false })
    doc.addImage(barcode, 'PNG', margin + 200, y - 12, 90, 22)
  } catch {
    // continue silently
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const dateStr = data.date.toLocaleDateString('en-US')
  doc.text(`Date: ${dateStr}`, pageWidth - margin, y, { align: 'right' })

  y += 20
  doc.text(`Ticket No. ${data.ticketNumber}`, margin, y)
  doc.text(`Customer PO #: ${data.customerPONumber}`, pageWidth - margin, y, { align: 'right' })

  if (data.shipmentLabel) {
    y += 16
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...ACCENT_ORANGE)
    doc.text(data.shipmentLabel, margin, y)
    if (data.originalPallets && data.originalPallets !== data.pallets) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(
        `(EPG release: ${data.originalPallets} skids total)`,
        margin,
        y + 12,
      )
      y += 12
    }
    doc.setTextColor(0, 0, 0)
  }

  y += 28

  // Ship-to / Ship-from columns
  const colWidth = (pageWidth - 2 * margin) / 2
  const fromY = drawAddressBlock(doc, margin, y, 'SHIP FROM:', JD_SHIP_FROM)
  const toY = drawAddressBlock(doc, margin + colWidth, y, 'SHIP TO:', EPG_SHIP_TO)
  y = Math.max(fromY, toY) + 24

  // Carrier banner
  doc.setFillColor(245, 240, 235) // cream
  doc.rect(margin, y - 4, pageWidth - 2 * margin, 30, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...JD_BLUE)
  doc.text(
    `SHIP VIA: ${data.carrier.toUpperCase()}    |    FREIGHT: ${data.freightTerms.toUpperCase()}`,
    pageWidth / 2,
    y + 14,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)
  y += 44

  // Line items table
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const colX = [margin, margin + 90, margin + 290, margin + 360, margin + 425, margin + 490]
  doc.text('Part #', colX[0], y)
  doc.text('Description', colX[1], y)
  doc.text('Units/Box', colX[2], y)
  doc.text('Boxes/Skid', colX[3], y)
  doc.text('Ordered', colX[4], y)
  doc.text('Shipped', colX[5], y)
  y += 4
  doc.setDrawColor(...JD_BLUE)
  doc.setLineWidth(1)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const item of data.lineItems) {
    doc.text(item.partNumber, colX[0], y)
    const descLines = doc.splitTextToSize(item.description, colX[2] - colX[1] - 8)
    doc.text(descLines, colX[1], y)
    doc.text(String(item.unitsPerBox), colX[2], y)
    const boxesPerSkid = item.unitsPerBox > 0 ? Math.round(item.shipped / item.unitsPerBox) : 0
    doc.text(String(boxesPerSkid), colX[3], y)
    doc.text(item.ordered.toLocaleString(), colX[4], y)
    doc.text(item.shipped.toLocaleString(), colX[5], y)
    y += Math.max(20, (descLines.length || 1) * 12 + 4)
  }
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  // Special instructions (always shown — skid type required, notes optional)
  const skidTypeLabel = formatSkidType(data.skidType)
  const instructionLines: string[] = [`SKID TYPE: ${skidTypeLabel}`]
  if (data.notes) instructionLines.push(`SPECIAL INSTRUCTIONS: ${data.notes}`)
  const instructionsBoxH = 18 + instructionLines.length * 14
  doc.setFillColor(254, 243, 199)
  doc.rect(margin, y - 4, pageWidth - 2 * margin, instructionsBoxH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(180, 0, 0)
  for (let i = 0; i < instructionLines.length; i++) {
    doc.text(instructionLines[i], margin + 8, y + 12 + i * 14, {
      maxWidth: pageWidth - 2 * margin - 16,
    })
  }
  doc.setTextColor(0, 0, 0)
  y += instructionsBoxH + 14

  // Footer block
  const footerY = pageHeight - 130
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Pallets: ${data.pallets}`, margin, footerY)
  doc.text(`Cartons: ${data.cartons}`, margin, footerY + 14)
  doc.text(`Weight: ${data.weight} lbs.`, margin, footerY + 28)
  doc.text(`Shipping Class: ${data.shippingClass}`, margin, footerY + 42)

  doc.text(
    `Ship Date: ${data.shipDate ? data.shipDate.toLocaleDateString('en-US') : 'TBD'}`,
    margin + colWidth,
    footerY,
  )
  doc.text(`Carrier: ${data.carrier}`, margin + colWidth, footerY + 14)
  doc.text(`Freight Terms: ${data.freightTerms}`, margin + colWidth, footerY + 28)

  // Signature lines
  const sigY = pageHeight - 60
  doc.setLineWidth(0.5)
  doc.line(margin, sigY, margin + 200, sigY)
  doc.line(margin + 240, sigY, margin + 440, sigY)
  doc.setFontSize(8)
  doc.text('Driver Signature', margin, sigY + 12)
  doc.text('Date', margin + 240, sigY + 12)

  // Brand footer
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text(
    'JD Graphic, Co Inc — printed via inventory-release-app',
    pageWidth / 2,
    pageHeight - 24,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)
}

// VICS-format BOL helpers: thin gridlines, black header bands, label/value cells.
function drawCellBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.6)
  doc.rect(x, y, w, h)
}

function drawHeaderBand(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
): void {
  doc.setFillColor(0, 0, 0)
  doc.rect(x, y, w, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(label, x + 4, y + 10)
  doc.setTextColor(0, 0, 0)
}

function drawLabelCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueFontSize = 11,
): void {
  drawCellBox(doc, x, y, w, h)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text(label, x + 4, y + 9)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(valueFontSize)
  if (value) {
    const valLines = doc.splitTextToSize(value, w - 8)
    doc.text(valLines, x + 4, y + 22)
  }
}

function drawCheckbox(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  checked: boolean,
): void {
  doc.setLineWidth(0.6)
  doc.rect(x, y, size, size)
  if (checked) {
    doc.setFillColor(0, 0, 0)
    doc.rect(x + 1.5, y + 1.5, size - 3, size - 3, 'F')
  }
}

function drawBolPage(doc: jsPDF, data: JdShipmentPaperworkData): void {
  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const innerW = pageWidth - 2 * margin

  // ─── Title ──────────────────────────────────────────────────
  let y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('BILL OF LADING', pageWidth / 2, y + 14, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Non-Negotiable — Original', pageWidth / 2, y + 28, { align: 'center' })
  y += 42

  // ─── Row: Carrier | BOL # | Date ────────────────────────────
  const r1H = 36
  const carrierW = innerW * 0.5
  const bolW = innerW * 0.3
  const dateW = innerW - carrierW - bolW
  drawLabelCell(doc, margin, y, carrierW, r1H, 'CARRIER',
    `${data.carrier.toUpperCase()}${data.carrierAccountNumber ? `   ·   ACCT # ${data.carrierAccountNumber}` : ''}`, 13)
  drawLabelCell(doc, margin + carrierW, y, bolW, r1H, 'BOL NUMBER', data.releaseNumber, 12)
  drawLabelCell(doc, margin + carrierW + bolW, y, dateW, r1H, 'DATE',
    data.date.toLocaleDateString('en-US'), 11)
  y += r1H

  // ─── Row: Carrier PRO | Shipper Reference | Trailer/Seal ────
  const r2H = 32
  const proW = innerW * 0.4
  const refW = innerW * 0.35
  const trailerW = innerW - proW - refW
  drawLabelCell(doc, margin, y, proW, r2H, 'CARRIER PRO / TRACKING NO.', '', 10)
  drawLabelCell(doc, margin + proW, y, refW, r2H, 'SHIPPER REFERENCE',
    `Ticket ${data.ticketNumber.replace(/^TKT-?/i, '').replace(/^BATCH-?/i, '')}`, 10)
  drawLabelCell(doc, margin + proW + refW, y, trailerW, r2H, 'TRAILER / SEAL NO.', '', 10)
  y += r2H

  // ─── Row: SHIP FROM | SHIP TO ───────────────────────────────
  const addrH = 78
  const halfW = innerW / 2
  // SHIP FROM band + box
  drawHeaderBand(doc, margin, y, halfW, 'SHIP FROM')
  drawCellBox(doc, margin, y + 14, halfW, addrH - 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(JD_SHIP_FROM.name, margin + 6, y + 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(JD_SHIP_FROM.address, margin + 6, y + 42)
  doc.text(`${JD_SHIP_FROM.city}, ${JD_SHIP_FROM.state} ${JD_SHIP_FROM.zip}`, margin + 6, y + 55)
  doc.setFontSize(9)
  doc.text(`Phone: ${JD_SHIP_FROM.phone}`, margin + 6, y + 68)
  // SHIP TO band + box
  drawHeaderBand(doc, margin + halfW, y, halfW, 'SHIP TO')
  drawCellBox(doc, margin + halfW, y + 14, halfW, addrH - 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(EPG_SHIP_TO.name, margin + halfW + 6, y + 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(EPG_SHIP_TO.address, margin + halfW + 6, y + 42)
  doc.text(`${EPG_SHIP_TO.city}, ${EPG_SHIP_TO.state} ${EPG_SHIP_TO.zip}`, margin + halfW + 6, y + 55)
  doc.setFontSize(9)
  doc.text('Receiving Hours: ____________________', margin + halfW + 6, y + 68)
  y += addrH

  // ─── Row: Third Party Bill-To | Special Instructions ────────
  const tpH = 70
  drawHeaderBand(doc, margin, y, halfW, 'THIRD PARTY FREIGHT CHARGES BILL TO')
  drawCellBox(doc, margin, y + 14, halfW, tpH - 14)
  if (data.freightTerms.toLowerCase() === 'prepaid') {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text('(Prepaid — bills to JD account)', margin + 6, y + 28)
    doc.setTextColor(0, 0, 0)
  }
  drawHeaderBand(doc, margin + halfW, y, halfW, 'SPECIAL INSTRUCTIONS')
  drawCellBox(doc, margin + halfW, y + 14, halfW, tpH - 14)
  if (data.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    const noteLines = doc.splitTextToSize(data.notes, halfW - 12)
    doc.text(noteLines, margin + halfW + 6, y + 28)
  }
  y += tpH

  // ─── Row: Freight Terms | Master BOL | C.O.D. ───────────────
  const ftH = 28
  const ftW = innerW * 0.5
  const mbW = innerW * 0.3
  const codW = innerW - ftW - mbW
  drawCellBox(doc, margin, y, ftW, ftH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('FREIGHT CHARGE TERMS', margin + 4, y + 9)
  doc.setTextColor(0, 0, 0)
  const isPrepaid = data.freightTerms.toLowerCase() === 'prepaid'
  const isCollect = data.freightTerms.toLowerCase() === 'collect'
  const is3rd = data.freightTerms.toLowerCase().includes('third') || data.freightTerms.toLowerCase().includes('3rd')
  drawCheckbox(doc, margin + 6, y + 16, 7, isPrepaid)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Prepaid', margin + 17, y + 22)
  drawCheckbox(doc, margin + 70, y + 16, 7, isCollect)
  doc.text('Collect', margin + 81, y + 22)
  drawCheckbox(doc, margin + 130, y + 16, 7, is3rd)
  doc.text('3rd Party', margin + 141, y + 22)

  drawCellBox(doc, margin + ftW, y, mbW, ftH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('MASTER BOL W/ UNDERLYING BOLS', margin + ftW + 4, y + 9)
  doc.setTextColor(0, 0, 0)
  drawCheckbox(doc, margin + ftW + 6, y + 16, 7, false)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Yes', margin + ftW + 17, y + 22)
  drawCheckbox(doc, margin + ftW + 50, y + 16, 7, true)
  doc.text('No', margin + ftW + 61, y + 22)

  drawLabelCell(doc, margin + ftW + mbW, y, codW, ftH, 'C.O.D.', 'N/A', 10)
  y += ftH

  // ─── Commodity table ────────────────────────────────────────
  // Columns: Handling Units | Packages | Weight | HM | Description | NMFC# | Class
  const colW = [
    innerW * 0.10, // Handling Units
    innerW * 0.10, // Packages
    innerW * 0.09, // Weight
    innerW * 0.05, // HM
    innerW * 0.50, // Description
    innerW * 0.08, // NMFC
    innerW * 0.08, // Class
  ]
  const colXArr = [margin]
  for (let i = 0; i < colW.length - 1; i++) colXArr.push(colXArr[i] + colW[i])

  const headH = 32
  // Header band across the whole row
  doc.setFillColor(0, 0, 0)
  doc.rect(margin, y, innerW, headH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  const headerLabels = [
    'HANDLING\nUNITS\nQTY / TYPE',
    'PACKAGES\nQTY / TYPE',
    'WEIGHT\n(LBS)',
    'H.M.\n(X)',
    'COMMODITY DESCRIPTION',
    'NMFC #',
    'CLASS',
  ]
  for (let i = 0; i < headerLabels.length; i++) {
    const lines = headerLabels[i].split('\n')
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], colXArr[i] + colW[i] / 2, y + 10 + li * 8, { align: 'center' })
    }
  }
  doc.setTextColor(0, 0, 0)
  y += headH

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const skidNoun = `${formatSkidType(data.skidType)} Skid`
  const rows = data.perSkidLineItems
    ? data.perSkidLineItems.map((s) => ({
        units: `1 ${skidNoun}`,
        pkgs: `${s.cartons} Ctns`,
        weight: String(s.weight),
        hm: '',
        desc: `PN ${s.partNumber} — ${s.description}\nPrinted manuals, shrink-wrapped, boxed · ${s.unitsPerBox} pcs/ctn · ${s.units.toLocaleString()} pcs total`,
        nmfc: '',
        class: data.shippingClass,
      }))
    : data.lineItems.map((it) => ({
        units: `${data.pallets} ${skidNoun}${data.pallets === 1 ? '' : 's'}`,
        pkgs: `${data.cartons} Ctns`,
        weight: String(data.weight),
        hm: '',
        desc: `PN ${it.partNumber} — ${it.description}\nPrinted manuals, shrink-wrapped, boxed · ${it.unitsPerBox} pcs/ctn · ${it.shipped.toLocaleString()} pcs total`,
        nmfc: '',
        class: data.shippingClass,
      }))

  // Render rows + a few empty rows so the table has visual depth like the Estes form
  const rowH = 38
  const totalRows = Math.max(4, rows.length)
  for (let r = 0; r < totalRows; r++) {
    // Vertical lines for each column
    for (let i = 0; i < colXArr.length; i++) {
      doc.setLineWidth(0.6)
      doc.line(colXArr[i], y, colXArr[i], y + rowH)
    }
    doc.line(margin + innerW, y, margin + innerW, y + rowH)
    // Bottom line for this row
    doc.line(margin, y + rowH, margin + innerW, y + rowH)

    if (r < rows.length) {
      const row = rows[r]
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(row.units, colXArr[0] + colW[0] / 2, y + 22, { align: 'center' })
      doc.text(row.pkgs, colXArr[1] + colW[1] / 2, y + 22, { align: 'center' })
      doc.text(row.weight, colXArr[2] + colW[2] / 2, y + 22, { align: 'center' })
      doc.text(row.hm, colXArr[3] + colW[3] / 2, y + 22, { align: 'center' })

      // Description: bold first line (PN — name), normal remainder
      const descParts = row.desc.split('\n')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      const headerLines = doc.splitTextToSize(descParts[0], colW[4] - 8)
      doc.text(headerLines, colXArr[4] + 4, y + 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      if (descParts[1]) {
        const detailLines = doc.splitTextToSize(descParts[1], colW[4] - 8)
        doc.text(detailLines, colXArr[4] + 4, y + 12 + headerLines.length * 10 + 2)
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(row.nmfc, colXArr[5] + colW[5] / 2, y + 22, { align: 'center' })
      doc.text(row.class, colXArr[6] + colW[6] / 2, y + 22, { align: 'center' })
    }
    y += rowH
  }

  // GRAND TOTAL row
  const totalH = 26
  doc.setFillColor(235, 235, 235)
  doc.rect(margin, y, innerW, totalH, 'F')
  for (let i = 0; i < colXArr.length; i++) {
    doc.setLineWidth(0.6)
    doc.line(colXArr[i], y, colXArr[i], y + totalH)
  }
  doc.line(margin + innerW, y, margin + innerW, y + totalH)
  doc.line(margin, y + totalH, margin + innerW, y + totalH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const totalUnits = data.lineItems.reduce((sum, it) => sum + it.shipped, 0)
  doc.text(
    `${data.pallets} ${skidNoun}${data.pallets === 1 ? '' : 's'}`,
    colXArr[0] + colW[0] / 2, y + 16, { align: 'center' },
  )
  doc.text(`${data.cartons} Ctns`, colXArr[1] + colW[1] / 2, y + 16, { align: 'center' })
  doc.text(String(data.weight), colXArr[2] + colW[2] / 2, y + 16, { align: 'center' })
  doc.text(
    `GRAND TOTAL — ${totalUnits.toLocaleString()} pcs`,
    colXArr[4] + colW[4] / 2, y + 16, { align: 'center' },
  )
  doc.text(data.shippingClass, colXArr[6] + colW[6] / 2, y + 16, { align: 'center' })
  y += totalH + 8

  // ─── Liability note ─────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(60, 60, 60)
  const liability =
    'NOTE: Liability Limitation for loss or damage in this shipment may be applicable. See 49 U.S.C. § 14706(c)(1)(A) and (B). Received, subject to individually determined rates or contracts that have been agreed upon in writing between the carrier and shipper, if applicable, otherwise to the rates, classifications and rules that have been established by the carrier and are available to the shipper, on request. The property described above, in apparent good order, except as noted (contents and condition of contents of packages unknown), marked, consigned, and destined as indicated above.'
  const liabilityLines = doc.splitTextToSize(liability, innerW - 8)
  doc.text(liabilityLines, margin + 4, y + 8)
  doc.setTextColor(0, 0, 0)
  y += liabilityLines.length * 8 + 8

  // ─── Signature blocks ───────────────────────────────────────
  const sigH = 70
  const sigW = innerW / 3
  drawCellBox(doc, margin, y, sigW, sigH)
  drawCellBox(doc, margin + sigW, y, sigW, sigH)
  drawCellBox(doc, margin + 2 * sigW, y, sigW, sigH)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('SHIPPER SIGNATURE / DATE', margin + 4, y + 10)
  doc.text('TRAILER LOADED / FREIGHT COUNTED', margin + sigW + 4, y + 10)
  doc.text('CARRIER SIGNATURE / PICKUP DATE', margin + 2 * sigW + 4, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const shipperBlurb = doc.splitTextToSize(
    'This is to certify that the above named materials are properly classified, described, packaged, marked and labeled, and are in proper condition for transportation according to applicable regulations of the DOT.',
    sigW - 8,
  )
  doc.text(shipperBlurb, margin + 4, y + 22)
  doc.text('X _______________________________', margin + 4, y + sigH - 18)
  doc.text('Date: ____________________________', margin + 4, y + sigH - 6)

  // Trailer loaded / freight counted checkboxes
  const tlOptions = ['By Shipper', 'By Driver', 'By Shipper', 'By Driver / pieces', 'By Driver / pallets said to contain']
  for (let i = 0; i < tlOptions.length; i++) {
    drawCheckbox(doc, margin + sigW + 6, y + 22 + i * 10, 6, false)
    doc.text(tlOptions[i], margin + sigW + 16, y + 27 + i * 10)
  }

  const carrierBlurb = doc.splitTextToSize(
    'Carrier acknowledges receipt of packages and required placards. Carrier certifies emergency response information was made available and/or carrier has the DOT emergency response guidebook.',
    sigW - 8,
  )
  doc.text(carrierBlurb, margin + 2 * sigW + 4, y + 22)
  doc.text('X _______________________________', margin + 2 * sigW + 4, y + sigH - 18)
  doc.text('Date: ____________________________', margin + 2 * sigW + 4, y + sigH - 6)
}

export function generateJdShipmentPaperwork(data: JdShipmentPaperworkData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  drawPackingSlipPage(doc, data)
  drawBolPage(doc, data)
  return doc
}

export function generateJdShipmentPaperworkBuffer(data: JdShipmentPaperworkData): Buffer {
  const doc = generateJdShipmentPaperwork(data)
  return Buffer.from(doc.output('arraybuffer'))
}

export type { JdShipmentPaperworkData }
