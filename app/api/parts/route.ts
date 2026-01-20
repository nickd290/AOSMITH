import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'

export async function PUT(request: NextRequest) {
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

    // Only admins can update parts
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { partId, boxesPerPallet, unitsPerBox, pricePerUnit, description } = body

    if (!partId) {
      return NextResponse.json(
        { error: 'Part ID is required' },
        { status: 400 }
      )
    }

    // Build update data with only provided fields
    const updateData: {
      boxesPerPallet?: number
      unitsPerBox?: number
      pricePerUnit?: number
      description?: string
    } = {}

    if (boxesPerPallet !== undefined) updateData.boxesPerPallet = boxesPerPallet
    if (unitsPerBox !== undefined) updateData.unitsPerBox = unitsPerBox
    if (pricePerUnit !== undefined) updateData.pricePerUnit = pricePerUnit
    if (description !== undefined) updateData.description = description

    const updatedPart = await prisma.part.update({
      where: { id: partId },
      data: updateData,
    })

    return NextResponse.json({ part: updatedPart })
  } catch (error) {
    console.error('Error updating part:', error)
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

    const parts = await prisma.part.findMany({
      orderBy: {
        partNumber: 'asc',
      },
    })

    // Calculate stock status for each part
    const partsWithStatus = parts.map((part) => {
      const totalBoxes = part.currentPallets * part.boxesPerPallet + part.currentBoxes
      const totalUnits = totalBoxes * part.unitsPerBox
      const percentOfAnnual = (totalUnits / part.annualOrder) * 100

      let status: 'good' | 'low' | 'critical'
      if (percentOfAnnual > 30) {
        status = 'good'
      } else if (percentOfAnnual > 15) {
        status = 'low'
      } else {
        status = 'critical'
      }

      return {
        ...part,
        pricePerUnit: part.pricePerUnit.toString(), // Convert to string for JSON
        totalBoxes,
        totalUnits,
        percentOfAnnual: Math.round(percentOfAnnual),
        status,
      }
    })

    return NextResponse.json({ parts: partsWithStatus })
  } catch (error) {
    console.error('Error fetching parts:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
