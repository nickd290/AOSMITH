import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { savePackingSlip, getPackingSlipFilePath } from '@/lib/documents/packing-slip'
import { saveBoxLabels, getBoxLabelsFilePath } from '@/lib/documents/box-labels'
import { saveInvoice, getInvoiceFilePath } from '@/lib/documents/invoice'
import { sendReleaseNotification } from '@/lib/email/sendgrid'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const {
      partId,
      shippingLocationId,
      pallets,
      boxes,
      notes,
      customerPONumber,
      batchNumber,
      shipVia,
      freightTerms,
      paymentTerms,
      manufactureDate,
      cartons,
      weight,
      shippingClass
    } = await request.json()

    if (!partId || !shippingLocationId || !customerPONumber) {
      return NextResponse.json(
        { error: 'Part ID, shipping location ID, and Customer PO# are required' },
        { status: 400 }
      )
    }

    // Get part details
    const part = await prisma.part.findUnique({
      where: { id: partId },
    })

    if (!part) {
      return NextResponse.json(
        { error: 'Part not found' },
        { status: 404 }
      )
    }

    // Check if there's enough inventory
    const requestedPallets = pallets || 5
    const requestedBoxes = boxes || 0

    if (part.currentPallets < requestedPallets ||
        (part.currentPallets === requestedPallets && part.currentBoxes < requestedBoxes)) {
      return NextResponse.json(
        { error: 'Insufficient inventory' },
        { status: 400 }
      )
    }

    // Calculate total units
    const totalBoxesReleased = requestedPallets * part.boxesPerPallet + requestedBoxes
    const totalUnits = totalBoxesReleased * part.unitsPerBox

    // Generate release number (format: REL-YYYYMMDD-XXXX)
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const count = await prisma.release.count()
    const releaseNumber = `REL-${dateStr}-${String(count + 1).padStart(4, '0')}`

    // Auto-generate ticket number if not provided
    const ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`

    // Auto-generate batch number if not provided
    const generatedBatchNumber = batchNumber || `${part.partNumber.slice(-4)}`

    // Create release
    const release = await prisma.release.create({
      data: {
        releaseNumber,
        partId,
        shippingLocationId,
        pallets: requestedPallets,
        boxes: requestedBoxes,
        totalUnits,
        userId: user.id,
        customerPONumber,
        ticketNumber,
        batchNumber: generatedBatchNumber,
        shipVia: shipVia || 'Averitt Collect',
        freightTerms: freightTerms || 'Prepaid',
        paymentTerms: paymentTerms || '2% 30, Net 60',
        manufactureDate: manufactureDate ? new Date(manufactureDate) : new Date(),
        cartons: cartons || totalBoxesReleased,
        weight: weight || 0,
        shippingClass: shippingClass || '55',
        notes,
        status: 'COMPLETED',
      },
      include: {
        part: true,
        shippingLocation: true,
        user: true,
      },
    })

    // Update part inventory
    let newPallets = part.currentPallets - requestedPallets
    let newBoxes = part.currentBoxes - requestedBoxes

    if (newBoxes < 0) {
      newPallets -= 1
      newBoxes += part.boxesPerPallet
    }

    await prisma.part.update({
      where: { id: partId },
      data: {
        currentPallets: newPallets,
        currentBoxes: newBoxes,
      },
    })

    // === AUTO-GENERATE ALL DOCUMENTS ===
    try {
      // 1. Generate Packing Slip
      const packingSlipData = {
        releaseNumber: release.releaseNumber,
        ticketNumber: release.ticketNumber || 'N/A',
        customerPONumber: release.customerPONumber,
        date: release.createdAt,
        shipTo: {
          name: release.shippingLocation.name,
          address: release.shippingLocation.address,
          city: release.shippingLocation.city,
          state: release.shippingLocation.state,
          zip: release.shippingLocation.zip,
        },
        shipFrom: {
          name: 'Enterprise Print Group',
          address: '6234 Enterprise Drive',
          city: 'Knoxville',
          state: 'TN',
          zip: '37909',
          country: 'USA',
        },
        lineItems: [
          {
            partNumber: release.part.partNumber,
            description: release.part.description,
            unitsPerBox: release.part.unitsPerBox,
            ordered: release.totalUnits,
            prevShip: 0,
            shipped: release.totalUnits,
            backOrdered: 0,
          },
        ],
        shipVia: release.shipVia || 'Averitt Collect',
        freightTerms: release.freightTerms || 'Prepaid',
        paymentTerms: release.paymentTerms || '2% 30, Net 60',
        cartons: release.cartons || (release.pallets * release.part.boxesPerPallet + release.boxes),
        weight: release.weight || 0,
        shippingClass: release.shippingClass || '55',
      }
      const packingSlipUrl = await savePackingSlip(release.id, packingSlipData)

      // 2. Generate Box Labels
      const totalBoxes = release.pallets * release.part.boxesPerPallet + release.boxes
      const boxLabelData = {
        partNumber: release.part.partNumber,
        description: release.part.description,
        unitsPerBox: release.part.unitsPerBox,
        batchNumber: release.batchNumber || 'N/A',
        manufactureDate: release.manufactureDate || release.createdAt,
        totalBoxes,
      }
      const boxLabelsUrl = await saveBoxLabels(release.id, boxLabelData)

      // 3. Generate Invoice
      const invoiceTotal = release.totalUnits * release.part.pricePerUnit
      const invoiceData = {
        invoiceNumber: release.releaseNumber,
        date: release.createdAt,
        customerPONumber: release.customerPONumber,
        billTo: {
          name: 'Enterprise Print Group',
          address: 'P.O. Box 52870',
          city: 'Knoxville',
          state: 'TN',
          zip: '37950',
        },
        billFrom: {
          name: 'Impact Direct',
          address: '1550 N Northwest Highway',
          city: 'Park Ridge',
          state: 'IL',
          zip: '60068',
        },
        lineItems: [
          {
            partNumber: release.part.partNumber,
            description: release.part.description,
            quantity: release.totalUnits,
            unitPrice: release.part.pricePerUnit,
            total: invoiceTotal,
          },
        ],
        subtotal: invoiceTotal,
        tax: 0,
        total: invoiceTotal,
        paymentTerms: release.paymentTerms || '2% 30, Net 60',
      }
      const invoiceUrl = await saveInvoice(release.id, invoiceData)

      // Update release with document URLs
      await prisma.release.update({
        where: { id: release.id },
        data: {
          packingSlipUrl,
          boxLabelsUrl,
          documentsGenerated: new Date().toISOString(),
        },
      })

      // 4. Send Email Notification
      await sendReleaseNotification(
        {
          releaseNumber: release.releaseNumber,
          partNumber: release.part.partNumber,
          partDescription: release.part.description,
          pallets: release.pallets,
          boxes: release.boxes,
          totalUnits: release.totalUnits,
          customerPONumber: release.customerPONumber,
          shippingLocation: release.shippingLocation.name,
          invoiceTotal: `$${invoiceTotal.toFixed(2)}`,
        },
        [
          {
            filename: 'packing-slip.pdf',
            filePath: getPackingSlipFilePath(release.id),
          },
          {
            filename: 'box-labels.pdf',
            filePath: getBoxLabelsFilePath(release.id),
          },
          {
            filename: 'invoice.pdf',
            filePath: getInvoiceFilePath(release.id),
          },
        ]
      )

      console.log('✅ Documents generated and email sent for release:', release.releaseNumber)
    } catch (emailError) {
      console.error('⚠️ Error generating documents or sending email:', emailError)
      // Don't fail the request if email fails - release was created successfully
    }

    return NextResponse.json({ release })
  } catch (error) {
    console.error('Error creating release:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get releases (all for admin, only own for customer)
    const whereClause = user.role === 'ADMIN' ? {} : { userId: user.id }

    const releases = await prisma.release.findMany({
      where: whereClause,
      include: {
        part: true,
        shippingLocation: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ releases })
  } catch (error) {
    console.error('Error fetching releases:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
