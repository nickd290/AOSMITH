import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { generatePackingSlip, savePackingSlip } from '@/lib/documents/packing-slip'
import { generateBoxLabels, saveBoxLabels } from '@/lib/documents/box-labels'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
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

    const { releaseId } = await params
    const { documentType } = await request.json()

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

    // Check authorization
    if (user.role !== 'ADMIN' && release.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to access this release' },
        { status: 403 }
      )
    }

    let packingSlipUrl = release.packingSlipUrl
    let boxLabelsUrl = release.boxLabelsUrl

    // Generate requested documents
    if (documentType === 'packing-slip' || documentType === 'all') {
      // Generate packing slip
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
          instructions: release.shippingLocation.instructions || undefined,
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

      packingSlipUrl = await savePackingSlip(releaseId, packingSlipData)
    }

    if (documentType === 'box-labels' || documentType === 'all') {
      // Generate box labels
      const totalBoxes = release.pallets * release.part.boxesPerPallet + release.boxes

      const boxLabelData = {
        partNumber: release.part.partNumber,
        description: release.part.description,
        unitsPerBox: release.part.unitsPerBox,
        batchNumber: release.batchNumber || 'N/A',
        manufactureDate: release.shipDate || release.createdAt,
        totalBoxes,
      }

      boxLabelsUrl = await saveBoxLabels(releaseId, boxLabelData)
    }

    // Update release with document URLs
    const updatedRelease = await prisma.release.update({
      where: { id: releaseId },
      data: {
        packingSlipUrl,
        boxLabelsUrl,
        documentsGenerated: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      packingSlipUrl,
      boxLabelsUrl,
      release: updatedRelease,
    })
  } catch (error) {
    console.error('Error generating documents:', error)
    return NextResponse.json(
      { error: 'An error occurred while generating documents' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve document URLs for a release
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
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

    const { releaseId } = await params

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        releaseNumber: true,
        packingSlipUrl: true,
        boxLabelsUrl: true,
        documentsGenerated: true,
        userId: true,
      },
    })

    if (!release) {
      return NextResponse.json(
        { error: 'Release not found' },
        { status: 404 }
      )
    }

    // Check authorization
    if (user.role !== 'ADMIN' && release.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to access this release' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      packingSlipUrl: release.packingSlipUrl,
      boxLabelsUrl: release.boxLabelsUrl,
      documentsGenerated: release.documentsGenerated,
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
