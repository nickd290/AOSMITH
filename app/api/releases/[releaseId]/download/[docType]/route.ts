import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { generatePackingSlipBuffer } from '@/lib/documents/packing-slip'
import { generateBoxLabelsBuffer } from '@/lib/documents/box-labels'
import { generateInvoiceBuffer } from '@/lib/documents/invoice'

const BOXES_PER_SKID = 68

/**
 * GET endpoint to download PDFs directly (no filesystem storage needed)
 * Generates PDF on-demand and streams it to the browser
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string; docType: string }> }
) {
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

    const { releaseId, docType } = await params

    // Validate document type
    const validTypes = ['packing-slip', 'box-labels', 'invoice']
    if (!validTypes.includes(docType)) {
      return NextResponse.json(
        { error: 'Invalid document type. Valid types: packing-slip, box-labels, invoice' },
        { status: 400 }
      )
    }

    // Get release with all related data
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        part: true,
        shippingLocation: true,
        user: true,
      },
    })

    if (!release) {
      return NextResponse.json(
        { error: 'Release not found' },
        { status: 404 }
      )
    }

    // All authenticated users can download documents
    // (Customer should have access to all release documents)

    let pdfBuffer: Buffer
    let filename: string

    if (docType === 'packing-slip') {
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

      pdfBuffer = generatePackingSlipBuffer(packingSlipData)
      filename = `packing-slip-${release.releaseNumber}.pdf`

    } else if (docType === 'box-labels') {
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

      pdfBuffer = generateBoxLabelsBuffer(boxLabelData)
      filename = `box-labels-${release.releaseNumber}.pdf`

    } else if (docType === 'invoice') {
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

      pdfBuffer = generateInvoiceBuffer(invoiceData)
      filename = `invoice-${release.releaseNumber}.pdf`

    } else {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      )
    }

    // Return PDF as binary response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error generating document:', error)
    return NextResponse.json(
      { error: 'An error occurred while generating the document' },
      { status: 500 }
    )
  }
}
