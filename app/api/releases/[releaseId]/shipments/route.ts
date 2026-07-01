import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { ensureDefaultShipment } from '@/lib/shipments/helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(authHeader.substring(7))
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { releaseId } = await params

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { part: true },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const shipments = await ensureDefaultShipment(release)
    const allocated = shipments.reduce((sum, s) => sum + s.pallets, 0)

    return NextResponse.json({
      originalPallets: release.pallets,
      originalTotalUnits: release.totalUnits,
      allocatedPallets: allocated,
      remainingPallets: release.pallets - allocated,
      shipments,
    })
  } catch (error) {
    console.error('Error fetching shipments:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}