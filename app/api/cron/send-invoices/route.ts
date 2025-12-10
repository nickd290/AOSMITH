import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateInvoiceBuffer } from '@/lib/documents/invoice'
import { sendInvoiceEmail } from '@/lib/email/sendgrid'

/**
 * Cron endpoint to send invoices for releases with ship date = today
 * Should be called daily (e.g., at 6 AM)
 *
 * Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get today's date range (start of day to end of day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    console.log(`📧 Running invoice cron job for ship date: ${today.toISOString().split('T')[0]}`)

    // Find all releases where:
    // - shipDate is today
    // - invoiceSent is false
    const releasesToInvoice = await prisma.release.findMany({
      where: {
        shipDate: {
          gte: today,
          lt: tomorrow,
        },
        invoiceSent: false,
      },
      include: {
        part: true,
        shippingLocation: true,
      },
    })

    console.log(`Found ${releasesToInvoice.length} releases to send invoices for`)

    const results = {
      total: releasesToInvoice.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const release of releasesToInvoice) {
      try {
        const invoiceTotal = release.totalUnits * release.part.pricePerUnit

        // Generate invoice data
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

        // Generate invoice PDF
        const invoiceBuffer = generateInvoiceBuffer(invoiceData)

        // Send invoice email
        await sendInvoiceEmail(
          {
            releaseNumber: release.releaseNumber,
            partNumber: release.part.partNumber,
            partDescription: release.part.description,
            pallets: release.pallets,
            boxes: release.boxes,
            totalUnits: release.totalUnits,
            customerPONumber: release.customerPONumber,
            shippingLocation: release.shippingLocation.name,
            invoiceTotal: `$${invoiceTotal.toFixed(2)}`,
            shipDate: release.shipDate || new Date(),
            etaDeliveryDate: release.etaDeliveryDate,
          },
          {
            filename: `invoice-${release.releaseNumber}.pdf`,
            content: invoiceBuffer.toString('base64'),
          }
        )

        // Mark invoice as sent
        await prisma.release.update({
          where: { id: release.id },
          data: {
            invoiceSent: true,
            invoiceSentAt: new Date(),
          },
        })

        console.log(`✅ Invoice sent for release: ${release.releaseNumber}`)
        results.sent++
      } catch (error) {
        console.error(`❌ Failed to send invoice for release ${release.releaseNumber}:`, error)
        results.failed++
        results.errors.push(`${release.releaseNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(`📊 Invoice cron job completed: ${results.sent} sent, ${results.failed} failed`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} releases`,
      results,
    })
  } catch (error) {
    console.error('Error in invoice cron job:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing invoices' },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint to manually trigger invoice sending for a specific release
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { releaseId } = await request.json()

    if (!releaseId) {
      return NextResponse.json(
        { error: 'releaseId is required' },
        { status: 400 }
      )
    }

    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        part: true,
        shippingLocation: true,
      },
    })

    if (!release) {
      return NextResponse.json(
        { error: 'Release not found' },
        { status: 404 }
      )
    }

    if (release.invoiceSent) {
      return NextResponse.json(
        { error: 'Invoice already sent for this release' },
        { status: 400 }
      )
    }

    const invoiceTotal = release.totalUnits * release.part.pricePerUnit

    // Generate invoice data
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

    // Generate invoice PDF
    const invoiceBuffer = generateInvoiceBuffer(invoiceData)

    // Send invoice email
    await sendInvoiceEmail(
      {
        releaseNumber: release.releaseNumber,
        partNumber: release.part.partNumber,
        partDescription: release.part.description,
        pallets: release.pallets,
        boxes: release.boxes,
        totalUnits: release.totalUnits,
        customerPONumber: release.customerPONumber,
        shippingLocation: release.shippingLocation.name,
        invoiceTotal: `$${invoiceTotal.toFixed(2)}`,
        shipDate: release.shipDate || new Date(),
        etaDeliveryDate: release.etaDeliveryDate,
      },
      {
        filename: `invoice-${release.releaseNumber}.pdf`,
        content: invoiceBuffer.toString('base64'),
      }
    )

    // Mark invoice as sent
    await prisma.release.update({
      where: { id: release.id },
      data: {
        invoiceSent: true,
        invoiceSentAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Invoice sent for release ${release.releaseNumber}`,
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    return NextResponse.json(
      { error: 'An error occurred while sending the invoice' },
      { status: 500 }
    )
  }
}
