import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { savePackingSlip, generatePackingSlipBuffer } from '@/lib/documents/packing-slip'
import { saveBoxLabels, generateBoxLabelsBuffer } from '@/lib/documents/box-labels'
import { generateOrderAcknowledgementBuffer } from '@/lib/documents/order-acknowledgement'
import { sendReleaseNotification, sendThreeZReleaseNotification } from '@/lib/email/sendgrid'
import { createImpactJob, isImpactd122Configured } from '@/lib/integrations/impactd122'
import { createThreezPortalJob, isThreezPortalConfigured } from '@/lib/integrations/threez-portal'

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

    // Calculate total units using the part's configured boxes per pallet
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

    // Update part inventory using part's configured boxes per pallet
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
    // Build data objects first (no I/O)
    // Combine shipping location instructions with release notes for packing slip
    const shippingInstructions = [
      release.shippingLocation.instructions,
      release.notes
    ].filter(Boolean).join(' | ') || undefined

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
        instructions: shippingInstructions,
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

    const totalBoxes = release.pallets * release.part.boxesPerPallet + release.boxes
    const boxLabelData = {
      partNumber: release.part.partNumber,
      description: release.part.description,
      unitsPerBox: release.part.unitsPerBox,
      batchNumber: release.batchNumber || 'N/A',
      manufactureDate: release.shipDate || release.createdAt,
      totalBoxes,
    }

    const orderTotal = release.totalUnits * release.part.pricePerUnit
    const orderAckData = {
      orderNumber: release.releaseNumber,
      date: release.createdAt,
      customerPONumber: release.customerPONumber,
      shipDate: release.shipDate || release.createdAt,
      etaDeliveryDate: release.etaDeliveryDate,
      shipTo: {
        name: release.shippingLocation.name,
        address: release.shippingLocation.address,
        city: release.shippingLocation.city,
        state: release.shippingLocation.state,
        zip: release.shippingLocation.zip,
      },
      shipFrom: {
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
          total: orderTotal,
        },
      ],
      subtotal: orderTotal,
      total: orderTotal,
      paymentTerms: release.paymentTerms || '2% 30, Net 60',
    }

    // 1. Try to save documents to storage (optional - non-blocking)
    let packingSlipUrl: string | null = null
    let boxLabelsUrl: string | null = null

    try {
      packingSlipUrl = await savePackingSlip(release.id, packingSlipData)
      boxLabelsUrl = await saveBoxLabels(release.id, boxLabelData)

      // Update release with document URLs
      await prisma.release.update({
        where: { id: release.id },
        data: {
          packingSlipUrl,
          boxLabelsUrl,
          documentsGenerated: new Date().toISOString(),
        },
      })
      console.log('✅ Documents saved to storage for release:', release.releaseNumber)
    } catch (saveError) {
      console.warn('⚠️ Document storage failed (email will still be sent):', saveError)
      // Continue - email is more important than file storage
    }

    // 2. Generate PDF buffers (needed for both email and ImpactD122 webhook)
    const packingSlipBuffer = generatePackingSlipBuffer(packingSlipData)
    const boxLabelsBuffer = generateBoxLabelsBuffer(boxLabelData)
    const orderAckBuffer = generateOrderAcknowledgementBuffer(orderAckData)

    // 3. Send Email Notification with PDF buffers (no filesystem dependency)
    // Send: Packing Slip, Box Labels, Order Acknowledgement (NOT Invoice)
    // Invoice will be sent separately on Ship Date
    try {
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
          invoiceTotal: `$${orderTotal.toFixed(2)}`,
          notes: release.notes || undefined,
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
            filename: 'order-acknowledgement.pdf',
            content: orderAckBuffer.toString('base64'),
          },
        ]
      )

      console.log('✅ Email sent for release:', release.releaseNumber)
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError)
      // Don't fail the request - release was created successfully
    }

    // Email 1B: Three Z release notification (box labels only, ship date prominent)
    try {
      await sendThreeZReleaseNotification(
        {
          releaseNumber: release.releaseNumber,
          partNumber: release.part.partNumber,
          partDescription: release.part.description,
          pallets: release.pallets,
          boxes: release.boxes,
          totalUnits: release.totalUnits,
          customerPONumber: release.customerPONumber,
          shippingLocation: release.shippingLocation.name,
          invoiceTotal: `$${orderTotal.toFixed(2)}`,
          notes: release.notes || undefined,
          shipDate: release.shipDate?.toISOString() ?? null,
        },
        {
          filename: 'box-labels.pdf',
          content: boxLabelsBuffer.toString('base64'),
        }
      )
      console.log('✅ Three Z release email sent for:', release.releaseNumber)
    } catch (threeZError) {
      console.error('❌ Three Z release email failed:', threeZError)
      // Don't fail the request
    }

    // 4. Create job in impactd122 via webhook
    if (isImpactd122Configured()) {
      try {
        const impactResult = await createImpactJob({
          // Required webhook fields
          externalJobId: release.id,
          jobNo: release.releaseNumber,
          companyName: 'EPrint Group',

          // Optional fields
          title: `EPG Release - ${release.part.partNumber}`,
          customerPONumber: release.customerPONumber,
          quantity: release.totalUnits,
          status: 'PO_RECEIVED',
          createdAt: new Date().toISOString(),
          specs: {
            source: 'inventory-release-app',
            releaseId: release.id,
            partNumber: release.part.partNumber,
            partDescription: release.part.description,
            pallets: release.pallets,
            boxes: release.boxes,
            totalUnits: release.totalUnits,
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
            sellPrice: orderTotal,

            // Cost basis and vendor info for PO creation
            // Default to ThreeZ for all EPrint Group releases (inventory stored at ThreeZ)
            costBasisPerUnit: release.part.costBasisPerUnit || 0.24,
            buyCost: release.totalUnits * (release.part.costBasisPerUnit || 0.24),
            vendorName: release.part.vendorName || 'ThreeZ',
            paperSource: 'VENDOR',

            // PDFs for ThreeZ email (base64 encoded)
            packingSlipPdf: packingSlipBuffer.toString('base64'),
            boxLabelsPdf: boxLabelsBuffer.toString('base64'),
          },
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

    // 5. Create job in Three Z Job Portal
    if (isThreezPortalConfigured()) {
      const releaseDetails = [
        `Release #: ${release.releaseNumber}`,
        `Part: ${release.part.partNumber} — ${release.part.description}`,
        `Customer PO#: ${release.customerPONumber}`,
        `Quantity: ${release.totalUnits.toLocaleString()} units (${release.pallets} pallets, ${release.boxes} boxes)`,
        `Ship To: ${release.shippingLocation.name}`,
        `Ship Via: ${release.shipVia || 'Averitt Collect'}`,
        release.shipDate ? `Ship Date: ${new Date(release.shipDate).toLocaleDateString('en-US')}` : null,
        release.notes ? `Notes: ${release.notes}` : null,
        '',
        'Source: Inventory Release App',
      ].filter(Boolean).join('\n')

      createThreezPortalJob({
        title: `EPG Release — ${release.part.partNumber} — ${release.totalUnits.toLocaleString()} units`,
        customerName: 'EPrint Group',
        emailBody: releaseDetails,
      }).catch((err) =>
        console.error('[threez-portal] Failed for release:', release.releaseNumber, err)
      )
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
      omit: {
        customerPackingSlipData: true,
      },
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
