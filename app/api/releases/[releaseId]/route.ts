import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'

// GET single release by ID
export async function GET(
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

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
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

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Non-admin users can only see their own releases
    if (user.role !== 'ADMIN' && release.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ release })
  } catch (error) {
    console.error('Error fetching release:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}

// PATCH - Update release (tracking number, ship date, status)
export async function PATCH(
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
    const body = await request.json()

    // Find the release first
    const existingRelease = await prisma.release.findUnique({
      where: { id: releaseId },
    })

    if (!existingRelease) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Non-admin users can only update their own releases
    if (user.role !== 'ADMIN' && existingRelease.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update data - only allow specific fields to be updated
    const updateData: Record<string, unknown> = {}

    if (body.trackingNumber !== undefined) {
      updateData.trackingNumber = body.trackingNumber
    }

    if (body.shipDate !== undefined) {
      updateData.shipDate = body.shipDate ? new Date(body.shipDate) : null
    }

    if (body.status !== undefined && ['COMPLETED', 'SHIPPED'].includes(body.status)) {
      updateData.status = body.status
    }

    // If tracking number is added, auto-set status to SHIPPED
    if (body.trackingNumber && !existingRelease.trackingNumber) {
      updateData.status = 'SHIPPED'
    }

    const release = await prisma.release.update({
      where: { id: releaseId },
      data: updateData,
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

    return NextResponse.json({ release })
  } catch (error) {
    console.error('Error updating release:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
