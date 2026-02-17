import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { uploadPDF } from '@/lib/storage'
import { sendPackingSlipReadyNotification } from '@/lib/email/sendgrid'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { releaseId } = await params

    // Get the release with related data
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        part: true,
        shippingLocation: true,
      },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    // Convert file to buffer and upload to R2
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = `customer-packing-slip-${release.releaseNumber}-${file.name}`

    const { url } = await uploadPDF(buffer, fileName)

    // Update release record
    const updatedRelease = await prisma.release.update({
      where: { id: releaseId },
      data: {
        customerPackingSlipUrl: url,
        customerPackingSlipName: file.name,
        customerPackingSlipUploadedAt: new Date(),
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
    })

    // Send "Ready to Ship" email with the PDF attached
    const loc = release.shippingLocation
    try {
      await sendPackingSlipReadyNotification(
        {
          releaseNumber: release.releaseNumber,
          customerPONumber: release.customerPONumber,
          partNumber: release.part.partNumber,
          partDescription: release.part.description,
          totalUnits: release.totalUnits,
          pallets: release.pallets,
          boxes: release.boxes,
          shippingLocation: `${loc.name} - ${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`,
          shipDate: release.shipDate?.toISOString() ?? null,
        },
        {
          filename: file.name,
          content: buffer.toString('base64'),
          type: 'application/pdf',
        }
      )
    } catch (emailError) {
      // Log but don't fail the upload if email fails
      console.error('Failed to send Ready to Ship email:', emailError)
    }

    return NextResponse.json({ release: updatedRelease })
  } catch (error) {
    console.error('Error uploading customer packing slip:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
