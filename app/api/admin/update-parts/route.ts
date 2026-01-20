import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary endpoint to update parts - DELETE AFTER USE
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Simple protection
  if (secret !== 'update51boxes2025') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Update part 100307705
    const part1 = await prisma.part.update({
      where: { partNumber: '100307705' },
      data: {
        unitsPerBox: 130,
        boxesPerPallet: 51
      }
    })

    // Update part 100309797
    const part2 = await prisma.part.update({
      where: { partNumber: '100309797' },
      data: {
        unitsPerBox: 130,
        boxesPerPallet: 51
      }
    })

    return NextResponse.json({
      success: true,
      updated: [
        { partNumber: part1.partNumber, boxesPerPallet: part1.boxesPerPallet },
        { partNumber: part2.partNumber, boxesPerPallet: part2.boxesPerPallet }
      ]
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
// Trigger rebuild Tue Jan 20 17:47:43 EST 2026
