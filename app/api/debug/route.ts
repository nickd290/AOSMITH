import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count()
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    // Get parts with key fields
    const parts = await prisma.part.findMany({
      select: {
        id: true,
        partNumber: true,
        description: true,
        unitsPerBox: true,
        boxesPerPallet: true,
      },
      orderBy: { partNumber: 'asc' },
    })

    // Get shipping locations
    const shippingLocations = await prisma.shippingLocation.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      userCount,
      users,
      parts,
      shippingLocations,
      env: {
        hasJwtSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: errorMessage,
      stack: errorStack,
    }, { status: 500 })
  }
}
