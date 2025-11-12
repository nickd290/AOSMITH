import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'

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

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const { partId, pallets, boxes, notes } = await request.json()

    if (!partId || pallets === undefined) {
      return NextResponse.json(
        { error: 'Part ID and pallets are required' },
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

    // Calculate total units
    const addedPallets = pallets || 0
    const addedBoxes = boxes || 0
    const totalBoxes = addedPallets * part.boxesPerPallet + addedBoxes
    const totalUnits = totalBoxes * part.unitsPerBox

    // Create production record
    const production = await prisma.production.create({
      data: {
        partId,
        pallets: addedPallets,
        boxes: addedBoxes,
        totalUnits,
        userId: user.id,
        notes,
      },
      include: {
        part: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Update part inventory
    await prisma.part.update({
      where: { id: partId },
      data: {
        currentPallets: part.currentPallets + addedPallets,
        currentBoxes: part.currentBoxes + addedBoxes,
      },
    })

    return NextResponse.json({ production })
  } catch (error) {
    console.error('Error creating production:', error)
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

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const productions = await prisma.production.findMany({
      include: {
        part: true,
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

    return NextResponse.json({ productions })
  } catch (error) {
    console.error('Error fetching productions:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
