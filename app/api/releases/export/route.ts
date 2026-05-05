/**
 * GET /api/releases/export
 *
 * Returns an .xlsx workbook with one row per release and every Release scalar
 * field flattened (plus part #, description, shipping location, user). Admin-only.
 * Nick filters / pivots in Excel — no server-side filtering.
 */

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null
    const tokenFromQuery = request.nextUrl.searchParams.get('token')
    const token = tokenFromHeader || tokenFromQuery

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const releases = await prisma.release.findMany({
      include: {
        part: { select: { partNumber: true, description: true } },
        shippingLocation: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'inventory-release-app'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Releases', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    sheet.columns = [
      { header: 'Release #', key: 'releaseNumber', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Created', key: 'createdAt', width: 18 },
      { header: 'Part #', key: 'partNumber', width: 16 },
      { header: 'Part Description', key: 'partDescription', width: 36 },
      { header: 'Shipping Location', key: 'shippingLocationName', width: 28 },
      { header: 'Pallets', key: 'pallets', width: 8 },
      { header: 'Boxes', key: 'boxes', width: 8 },
      { header: 'Total Units', key: 'totalUnits', width: 12 },
      { header: 'Skid Type', key: 'skidType', width: 14 },
      { header: 'Customer PO #', key: 'customerPONumber', width: 18 },
      { header: 'Ticket #', key: 'ticketNumber', width: 12 },
      { header: 'Batch #', key: 'batchNumber', width: 12 },
      { header: 'Ship Via', key: 'shipVia', width: 16 },
      { header: 'Carrier', key: 'carrier', width: 16 },
      { header: 'Carrier Account #', key: 'carrierAccountNumber', width: 18 },
      { header: 'Freight Terms', key: 'freightTerms', width: 14 },
      { header: 'Payment Terms', key: 'paymentTerms', width: 16 },
      { header: 'Cartons', key: 'cartons', width: 10 },
      { header: 'Weight (lbs)', key: 'weight', width: 12 },
      { header: 'Shipping Class', key: 'shippingClass', width: 12 },
      { header: 'Manufacture Date', key: 'manufactureDate', width: 18 },
      { header: 'Ship Date', key: 'shipDate', width: 18 },
      { header: 'ETA Delivery', key: 'etaDeliveryDate', width: 18 },
      { header: 'Shipped At', key: 'shippedAt', width: 18 },
      { header: 'PRO #', key: 'proNumber', width: 16 },
      { header: 'Tracking #', key: 'trackingNumber', width: 18 },
      { header: 'Invoice Sent', key: 'invoiceSent', width: 12 },
      { header: 'Invoice Sent At', key: 'invoiceSentAt', width: 18 },
      { header: 'Impact Job ID', key: 'impactJobId', width: 14 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 28 },
    ]

    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).alignment = { vertical: 'middle' }

    for (const r of releases) {
      sheet.addRow({
        releaseNumber: r.releaseNumber,
        status: r.status,
        createdAt: fmtDate(r.createdAt),
        partNumber: r.part.partNumber,
        partDescription: r.part.description,
        shippingLocationName: r.shippingLocation.name,
        pallets: r.pallets,
        boxes: r.boxes,
        totalUnits: r.totalUnits,
        skidType: r.skidType,
        customerPONumber: r.customerPONumber,
        ticketNumber: r.ticketNumber ?? '',
        batchNumber: r.batchNumber ?? '',
        shipVia: r.shipVia ?? '',
        carrier: r.carrier ?? '',
        carrierAccountNumber: r.carrierAccountNumber ?? '',
        freightTerms: r.freightTerms ?? '',
        paymentTerms: r.paymentTerms ?? '',
        cartons: r.cartons ?? '',
        weight: r.weight ?? '',
        shippingClass: r.shippingClass ?? '',
        manufactureDate: fmtDate(r.manufactureDate),
        shipDate: fmtDate(r.shipDate),
        etaDeliveryDate: fmtDate(r.etaDeliveryDate),
        shippedAt: fmtDate(r.shippedAt),
        proNumber: r.proNumber ?? '',
        trackingNumber: r.trackingNumber ?? '',
        invoiceSent: r.invoiceSent ? 'Yes' : 'No',
        invoiceSentAt: fmtDate(r.invoiceSentAt),
        impactJobId: r.impactJobId ?? '',
        notes: r.notes ?? '',
        userName: r.user.name,
        userEmail: r.user.email,
      })
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="releases-${today}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting releases to Excel:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
