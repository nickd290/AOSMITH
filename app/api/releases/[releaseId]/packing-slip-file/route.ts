import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const tokenParam = request.nextUrl.searchParams.get('token')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : tokenParam

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { releaseId } = await params

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        customerPackingSlipData: true,
        customerPackingSlipName: true,
      },
    })

    if (!release?.customerPackingSlipData) {
      return NextResponse.json({ error: 'Packing slip not found' }, { status: 404 })
    }

    const filename = release.customerPackingSlipName || 'packing-slip.pdf'

    return new NextResponse(release.customerPackingSlipData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error serving packing slip:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
