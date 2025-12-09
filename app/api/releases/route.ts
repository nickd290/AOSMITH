import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { savePackingSlip, generatePackingSlipBuffer } from '@/lib/documents/packing-slip'
import { saveBoxLabels, generateBoxLabelsBuffer } from '@/lib/documents/box-labels'
import { saveInvoice, generateInvoiceBuffer } from '@/lib/documents/invoice'
import { sendReleaseNotification } from '@/lib/email/sendgrid'
import { createImpactJob, isImpactd122Configured, getImpactd122CustomerId } from '@/lib/integrations/impactd122'

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
      shipDate,
      etaDeliveryDate,
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

    // Calculate total units - ALWAYS use 68 boxes per skid regardless of part settings
    const BOXES_PER_SKID = 68
    const totalBoxesReleased = requestedPallets * BOXES_PER_SKID + requestedBoxes
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
        shipDate: shipDate ? new Date(shipDate) : new Date(),
        etaDeliveryDate: etaDeliveryDate ? new Date(etaDeliveryDate) : null,
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

    // Update part inventory - ALWAYS use 68 boxes per skid
    let newPallets = part.currentPallets - requestedPallets
    let newBoxes = part.currentBoxes - requestedBoxes

    if (newBoxes < 0) {
      newPallets -= 1
      newBoxes += BOXES_PER_SKID
    }

    await prisma.part.update({
      where: { id: partId },
      data: {
        currentPallets: newPallets,
        currentBoxes: newBoxes,
      },
    })

    // === AUTO-GENERATE ALL DOCUMENTS ===
    // Build data objects first (no I/O)
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
      cartons: release.cartons || (release.pallets * BOXES_PER_SKID + release.boxes),
      weight: release.weight || 0,
      shippingClass: release.shippingClass || '55',
    }

    const totalBoxes = release.pallets * BOXES_PER_SKID + release.boxes
    const boxLabelData = {
      partNumber: release.part.partNumber,
      description: release.part.description,
      unitsPerBox: release.part.unitsPerBox,
      batchNumber: release.batchNumber || 'N/A',
      shipDate: release.shipDate || release.createdAt,
      etaDeliveryDate: release.etaDeliveryDate,
      totalBoxes,
    }

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

    // 1. Try to save documents to storage (optional - non-blocking)
    let packingSlipUrl: string | null = null
    let boxLabelsUrl: string | null = null
    let invoiceUrl: string | null = null

    try {
      packingSlipUrl = await savePackingSlip(release.id, packingSlipData)
      boxLabelsUrl = await saveBoxLabels(release.id, boxLabelData)
      invoiceUrl = await saveInvoice(release.id, invoiceData)

      // Update release with document URLs
      await prisma.release.update({
        where: { id: release.id },
        data: {
          packingSlipUrl,
          boxLabelsUrl,
          invoiceUrl,
          documentsGenerated: new Date().toISOString(),
        },
      })
      console.log('✅ Documents saved to storage for release:', release.releaseNumber)
    } catch (saveError) {
      console.warn('⚠️ Document storage failed (email will still be sent):', saveError)
      // Continue - email is more important than file storage
    }

    // 2. Send Email Notification with PDF buffers (no filesystem dependency)
    try {
      const packingSlipBuffer = generatePackingSlipBuffer(packingSlipData)
      const boxLabelsBuffer = generateBoxLabelsBuffer(boxLabelData)
      const invoiceBuffer = generateInvoiceBuffer(invoiceData)

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
            content: packingSlipBuffer.toString('base64'),
          },
          {
            filename: 'box-labels.pdf',
            content: boxLabelsBuffer.toString('base64'),
          },
          {
            filename: 'invoice.pdf',
            content: invoiceBuffer.toString('base64'),
          },
        ]
      )

      console.log('✅ Email sent for release:', release.releaseNumber)
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError)
      // Don't fail the request - release was created successfully
    }

    // 3. Create job in impactd122
    if (isImpactd122Configured()) {
      try {
        const impactResult = await createImpactJob({
          customerId: getImpactd122CustomerId(),
          title: `EPG Release - ${release.part.partNumber}`,
          description: `Release ${release.releaseNumber} - ${release.part.description}`,
          specs: {
            source: 'inventory-release-app',
            releaseNumber: release.releaseNumber,
            releaseId: release.id,
            partNumber: release.part.partNumber,
            partDescription: release.part.description,
            pallets: release.pallets,
            boxes: release.boxes,
            totalUnits: release.totalUnits,
            customerPONumber: release.customerPONumber,
            shippingLocation: release.shippingLocation.name,
            shippingAddress: {
              address: release.shippingLocation.address,
              city: release.shippingLocation.city,
              state: release.shippingLocation.state,
              zip: release.shippingLocation.zip,
            },
            ticketNumber: release.ticketNumber,
            batchNumber: release.batchNumber,
            manufactureDate: release.manufactureDate?.toISOString(),
            shipVia: release.shipVia,
            freightTerms: release.freightTerms,
          },
          quantity: release.totalUnits,
          customerPONumber: release.customerPONumber,
          sellPrice: invoiceTotal,
        })

        if (impactResult.success && impactResult.jobId) {
          await prisma.release.update({
            where: { id: release.id },
            data: { impactJobId: impactResult.jobId },
          })
          console.log('✅ Impact job created:', impactResult.jobId)
        } else {
          console.warn('⚠️ Failed to create Impact job:', impactResult.error)
        }
      } catch (impactError) {
        console.error('⚠️ Error creating Impact job:', impactError)
        // Don't fail the release if impactd122 fails
      }
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

    // Get all releases for both admin and customer
    // Customer should see all release history (same as admin)
    const whereClause = {}

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
