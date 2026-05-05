/**
 * Pallet flag — 8.5×11 sheet that gets stuck to each skid so the freight
 * crew can read FROM/TO/contents from across the dock. One page per skid.
 *
 * Visual design: same boxed/banded grid as the BOL (drawHeaderBand +
 * drawCellBox), so a flag and BOL placed side-by-side look like one set.
 */

import jsPDF from 'jspdf'
import { EPG_SHIP_TO, JD_SHIP_FROM } from '../epg'

interface LoadFlagSkid {
  skidNumber: number
  partNumber: string
  description: string
  units: number
  cartons?: number
  unitsPerBox?: number
  weight: number
}

type SkidTypeValue = 'WOOD' | 'HEAT_TREATED'

interface LoadFlagsData {
  releaseNumber: string
  date: Date
  carrier: string
  customerPONumber: string
  totalSkids: number
  totalWeight: number
  shippingClass: string
  skidType: SkidTypeValue
  shipTo?: { name: string; address: string; city: string; state: string; zip: string; phone?: string }
  shipFrom?: { name: string; address: string; city: string; state: string; zip: string; phone?: string }
  batchNumber?: string
  skids: LoadFlagSkid[]
}

const JD_BLUE: [number, number, number] = [26, 30, 46]
const ACCENT_RED: [number, number, number] = [180, 0, 0]

function drawHeaderBand(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): void {
  doc.setFillColor(0, 0, 0)
  doc.rect(x, y, w, h, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(label, x + 8, y + h / 2 + 3)
  doc.setTextColor(0, 0, 0)
}

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

function drawAddressCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  block: { name: string; address: string; city: string; state: string; zip: string; phone?: string },
): void {
  drawCellBox(doc, x, y, w, h)
  const padX = x + 10
  let cy = y + 24
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(block.name, padX, cy)
  cy += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.text(block.address, padX, cy)
  cy += 18
  doc.text(`${block.city}, ${block.state} ${block.zip}`, padX, cy)
  if (block.phone) {
    cy += 18
    doc.setFontSize(11)
    doc.text(`Phone: ${block.phone}`, padX, cy)
  }
}

function drawSkidPage(doc: jsPDF, data: LoadFlagsData, skid: LoadFlagSkid): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const innerW = pageWidth - 2 * margin
  const shipFrom = data.shipFrom ?? JD_SHIP_FROM
  // EPG default — strip phone from rendering (per Apr 2026 directive: paperwork
  // shows the visit address only, no contact info).
  const shipTo =
    data.shipTo ?? {
      name: EPG_SHIP_TO.name,
      address: EPG_SHIP_TO.address,
      city: EPG_SHIP_TO.city,
      state: EPG_SHIP_TO.state,
      zip: EPG_SHIP_TO.zip,
    }

  // ─── Title ──────────────────────────────────────────────────
  let y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('PALLET FLAG', pageWidth / 2, y + 22, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Ref: ${data.releaseNumber}    ·    ${data.date.toLocaleDateString('en-US')}    ·    Class ${data.shippingClass}`,
    pageWidth / 2,
    y + 38,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)
  y += 56

  // ─── SHIP FROM | SHIP TO ────────────────────────────────────
  const halfW = innerW / 2
  const bandH = 18
  const addrH = 110
  drawHeaderBand(doc, margin, y, halfW, bandH, 'SHIP FROM')
  drawHeaderBand(doc, margin + halfW, y, halfW, bandH, 'SHIP TO')
  drawAddressCell(doc, margin, y + bandH, halfW, addrH, shipFrom)
  drawAddressCell(doc, margin + halfW, y + bandH, halfW, addrH, shipTo)
  y += bandH + addrH + 14

  // ─── SKID X OF Y banner ─────────────────────────────────────
  const bannerH = 90
  doc.setFillColor(...JD_BLUE)
  doc.rect(margin, y, innerW, bannerH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(56)
  doc.text(
    `SKID ${skid.skidNumber} OF ${data.totalSkids}`,
    pageWidth / 2,
    y + bannerH / 2 + 18,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)
  y += bannerH + 14

  // ─── Details grid (label | value rows) ──────────────────────
  const cartons =
    skid.cartons ?? (skid.unitsPerBox ? Math.round(skid.units / skid.unitsPerBox) : undefined)

  const skidTypeLabel = data.skidType === 'HEAT_TREATED' ? 'HEAT-TREATED' : 'WOOD'

  type Row = { label: string; value: string; emphasize?: boolean }
  const rows: Row[] = [
    { label: 'PART #', value: skid.partNumber, emphasize: true },
    { label: 'DESCRIPTION', value: skid.description.toUpperCase() },
    { label: 'QUANTITY', value: `${skid.units.toLocaleString()} pcs`, emphasize: true },
    ...(cartons !== undefined ? [{ label: 'CARTONS', value: `${cartons} ctns` } as Row] : []),
    { label: 'WEIGHT', value: `${skid.weight} lbs`, emphasize: true },
    { label: 'SKID TYPE', value: skidTypeLabel, emphasize: true },
    ...(data.batchNumber ? [{ label: 'BATCH #', value: data.batchNumber } as Row] : []),
    { label: 'PO #', value: data.customerPONumber },
    { label: 'CARRIER', value: data.carrier },
  ]

  const rowH = 34
  const labelColW = 160
  const totalRowsH = rows.length * rowH
  // Outer table border
  drawCellBox(doc, margin, y, innerW, totalRowsH)
  // Vertical divider between label and value
  doc.setLineWidth(0.6)
  doc.line(margin + labelColW, y, margin + labelColW, y + totalRowsH)

  for (let i = 0; i < rows.length; i++) {
    const ry = y + i * rowH
    // Row separator (skip top edge — table border already there)
    if (i > 0) {
      doc.setLineWidth(0.4)
      doc.setDrawColor(180, 180, 180)
      doc.line(margin, ry, margin + innerW, ry)
      doc.setDrawColor(0, 0, 0)
    }
    // Label cell — light gray background for hierarchy
    doc.setFillColor(245, 245, 245)
    doc.rect(margin + 0.6, ry + 0.6, labelColW - 1.2, rowH - 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(80, 80, 80)
    doc.text(rows[i].label, margin + 12, ry + rowH / 2 + 3)
    doc.setTextColor(0, 0, 0)
    // Value cell
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(rows[i].emphasize ? 18 : 13)
    const valueLines = doc.splitTextToSize(rows[i].value, innerW - labelColW - 24)
    const startY =
      valueLines.length === 1
        ? ry + rowH / 2 + (rows[i].emphasize ? 6 : 4)
        : ry + 18
    doc.text(valueLines, margin + labelColW + 12, startY)
  }
  y += totalRowsH + 16

  // ─── DO NOT BREAK PALLETS footer ────────────────────────────
  const footerY = pageHeight - margin - 50
  doc.setFillColor(...ACCENT_RED)
  doc.rect(margin, footerY, innerW, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('DO NOT BREAK PALLETS', pageWidth / 2, footerY + 27, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `Total load: ${data.totalSkids} skids · ${data.totalWeight.toLocaleString()} lbs · Apply one flag per skid`,
    pageWidth / 2,
    pageHeight - margin / 2,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)
}

export function generateLoadFlags(data: LoadFlagsData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  data.skids.forEach((skid, idx) => {
    if (idx > 0) doc.addPage('letter', 'portrait')
    drawSkidPage(doc, data, skid)
  })
  return doc
}

export function generateLoadFlagsBuffer(data: LoadFlagsData): Buffer {
  const doc = generateLoadFlags(data)
  return Buffer.from(doc.output('arraybuffer'))
}

export type { LoadFlagsData, LoadFlagSkid }
