import sgMail from '@sendgrid/mail'
import * as fs from 'fs'

// Initialize SendGrid
const apiKey = process.env.SENDGRID_API_KEY || ''
if (apiKey) {
  sgMail.setApiKey(apiKey)
}

export interface EmailAttachment {
  filename: string
  filePath?: string      // File path to read from (legacy)
  content?: string       // Base64 content directly (preferred)
  type?: string
}

export interface ReleaseEmailData {
  releaseNumber: string
  partNumber: string
  partDescription: string
  pallets: number
  boxes: number
  totalUnits: number
  customerPONumber: string
  shippingLocation: string
  invoiceTotal: string
}

/**
 * Send release notification email with PDF attachments
 */
export async function sendReleaseNotification(
  emailData: ReleaseEmailData,
  attachments: EmailAttachment[]
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'EPG Release'
  const emailTo = process.env.EMAIL_TO || 'nick@jdgraphic.com'
  const emailCc = process.env.EMAIL_CC || ''

  // Prepare attachments for SendGrid
  const sgAttachments = attachments.map((att) => {
    // Use provided content directly, or read from file path
    let content = att.content
    if (!content && att.filePath) {
      try {
        content = fs.readFileSync(att.filePath).toString('base64')
      } catch (err) {
        console.error(`Failed to read attachment ${att.filename} from ${att.filePath}:`, err)
        return null
      }
    }
    if (!content) {
      console.error(`No content available for attachment ${att.filename}`)
      return null
    }
    return {
      content,
      filename: att.filename,
      type: att.type || 'application/pdf',
      disposition: 'attachment',
    }
  }).filter(Boolean) as Array<{ content: string; filename: string; type: string; disposition: string }>

  // Create HTML email body
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a4d6b 0%, #0d3147 100%); padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                          📦 Release Notification
                        </div>
                      </td>
                      <td align="right" style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 16px; font-weight: 700;">
                          ${emailData.releaseNumber}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content Card -->
              <tr>
                <td style="padding: 24px; background-color: #ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fafafa; border-left: 4px solid #1a4d6b; border-radius: 4px;">
                    <tr>
                      <td style="padding: 16px 20px;">

                        <!-- Two Column Grid -->
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <!-- Row 1 -->
                          <tr>
                            <td width="50%" style="padding: 0 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Release Number</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.releaseNumber}</div>
                            </td>
                            <td width="50%" style="padding: 0 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Customer PO #</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.customerPONumber}</div>
                            </td>
                          </tr>

                          <!-- Separator -->
                          <tr>
                            <td colspan="2" style="padding: 8px 0;">
                              <div style="height: 1px; background-color: #e5e7eb;"></div>
                            </td>
                          </tr>

                          <!-- Row 2 -->
                          <tr>
                            <td width="50%" style="padding: 12px 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Part Number</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.partNumber}</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Pallets</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.pallets}</div>
                            </td>
                          </tr>

                          <!-- Row 3 -->
                          <tr>
                            <td width="50%" style="padding: 0 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Description</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.partDescription}</div>
                            </td>
                            <td width="50%" style="padding: 0 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Boxes</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.boxes}</div>
                            </td>
                          </tr>

                          <!-- Separator -->
                          <tr>
                            <td colspan="2" style="padding: 8px 0;">
                              <div style="height: 1px; background-color: #e5e7eb;"></div>
                            </td>
                          </tr>

                          <!-- Row 4 -->
                          <tr>
                            <td width="50%" style="padding: 12px 8px 0 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship To</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.shippingLocation}</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 0 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Units</div>
                              <div style="font-size: 16px; color: #111827; font-weight: 700;">${emailData.totalUnits.toLocaleString()}</div>
                            </td>
                          </tr>
                        </table>

                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Invoice Total Highlight -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #1a4d6b 0%, #0d3147 100%); border-radius: 6px;">
                    <tr>
                      <td style="padding: 18px 24px; text-align: center;">
                        <div style="color: #93c5fd; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Invoice Total</div>
                        <div style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${emailData.invoiceTotal}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Attachments -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Attached Documents</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    ${attachments.map(att => `
                      <tr>
                        <td style="padding: 4px 0;">
                          <span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500;">
                            📄 ${att.filename}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                  <div style="color: #6b7280; font-size: 11px; line-height: 1.5;">
                    Enterprise Print Group – Automated Release Notification
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  // Plain text version for email clients that don't support HTML
  const textBody = `
New Release Created - ${emailData.releaseNumber}

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT INFORMATION
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}

QUANTITY
Pallets: ${emailData.pallets}
Boxes: ${emailData.boxes}
Total Units: ${emailData.totalUnits.toLocaleString()}

SHIPPING INFORMATION
Ship To: ${emailData.shippingLocation}

Invoice Total: ${emailData.invoiceTotal}

Attached Documents: ${attachments.map(att => att.filename).join(', ')}

---
Enterprise Print Group - Automated Release Notification
  `

  const msg = {
    to: emailTo,
    cc: emailCc.split(',').map(email => email.trim()).filter(email => email),
    from: {
      email: emailFrom,
      name: emailFromName,
    },
    subject: `New Release Created - ${emailData.releaseNumber}`,
    text: textBody,
    html: htmlBody,
    attachments: sgAttachments,
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid API key not configured. Email would have been sent to:', emailTo)
      console.log('📧 Subject:', msg.subject)
      console.log('📎 Attachments:', attachments.map(a => a.filename).join(', '))
      return
    }

    await sgMail.send(msg)
    const ccList = emailCc ? `, CC: ${emailCc}` : ''
    console.log(`✅ Email sent successfully to: ${emailTo}${ccList}`)
  } catch (error) {
    console.error('❌ Error sending email:', error)
    throw error
  }
}

/**
 * Send invoice email on ship date
 * To: ap@eprintgroup.com
 * CC: nick@jdgraphic.com, brandon@impactdirectprinting.com
 */
export async function sendInvoiceEmail(
  emailData: ReleaseEmailData & { shipDate: Date; etaDeliveryDate?: Date | null },
  invoiceAttachment: EmailAttachment
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'EPG Invoice'

  // Fixed recipients for invoice
  const emailTo = 'ap@eprintgroup.com'
  const emailCc = ['nick@jdgraphic.com', 'brandon@impactdirectprinting.com']

  // Prepare attachment for SendGrid
  const sgAttachment = {
    content: invoiceAttachment.content || '',
    filename: invoiceAttachment.filename,
    type: invoiceAttachment.type || 'application/pdf',
    disposition: 'attachment' as const,
  }

  const shipDateStr = emailData.shipDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const etaStr = emailData.etaDeliveryDate
    ? emailData.etaDeliveryDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A'

  // Create HTML email body for invoice
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #166534 0%, #14532d 100%); padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                          💰 Invoice - Ship Date
                        </div>
                      </td>
                      <td align="right" style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 16px; font-weight: 700;">
                          ${emailData.releaseNumber}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Ship Date Banner -->
              <tr>
                <td style="padding: 24px; background-color: #f0fdf4; border-bottom: 2px solid #22c55e;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="50%">
                        <div style="font-size: 11px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship Date</div>
                        <div style="font-size: 16px; color: #14532d; font-weight: 700;">${shipDateStr}</div>
                      </td>
                      <td width="50%">
                        <div style="font-size: 11px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">ETA Delivery</div>
                        <div style="font-size: 16px; color: #14532d; font-weight: 700;">${etaStr}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content Card -->
              <tr>
                <td style="padding: 24px; background-color: #ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fafafa; border-left: 4px solid #166534; border-radius: 4px;">
                    <tr>
                      <td style="padding: 16px 20px;">

                        <!-- Two Column Grid -->
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <!-- Row 1 -->
                          <tr>
                            <td width="50%" style="padding: 0 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Release Number</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.releaseNumber}</div>
                            </td>
                            <td width="50%" style="padding: 0 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Customer PO #</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.customerPONumber}</div>
                            </td>
                          </tr>

                          <!-- Separator -->
                          <tr>
                            <td colspan="2" style="padding: 8px 0;">
                              <div style="height: 1px; background-color: #e5e7eb;"></div>
                            </td>
                          </tr>

                          <!-- Row 2 -->
                          <tr>
                            <td width="50%" style="padding: 12px 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Part Number</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.partNumber}</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Description</div>
                              <div style="font-size: 13px; color: #374151;">${emailData.partDescription}</div>
                            </td>
                          </tr>

                          <!-- Separator -->
                          <tr>
                            <td colspan="2" style="padding: 8px 0;">
                              <div style="height: 1px; background-color: #e5e7eb;"></div>
                            </td>
                          </tr>

                          <!-- Row 3 -->
                          <tr>
                            <td width="50%" style="padding: 12px 8px 0 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship To</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.shippingLocation}</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 0 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Units</div>
                              <div style="font-size: 16px; color: #111827; font-weight: 700;">${emailData.totalUnits.toLocaleString()}</div>
                            </td>
                          </tr>
                        </table>

                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Invoice Total Highlight -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #166534 0%, #14532d 100%); border-radius: 6px;">
                    <tr>
                      <td style="padding: 18px 24px; text-align: center;">
                        <div style="color: #bbf7d0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Invoice Total Due</div>
                        <div style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${emailData.invoiceTotal}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Attachments -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Attached Invoice</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500;">
                          📄 ${invoiceAttachment.filename}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                  <div style="color: #6b7280; font-size: 11px; line-height: 1.5;">
                    Impact Direct – Invoice Notification<br>
                    Payment Terms: 2% 30, Net 60
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  // Plain text version
  const textBody = `
INVOICE - ${emailData.releaseNumber}

SHIP DATE: ${shipDateStr}
ETA DELIVERY: ${etaStr}

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT INFORMATION
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Total Units: ${emailData.totalUnits.toLocaleString()}

SHIPPING INFORMATION
Ship To: ${emailData.shippingLocation}

INVOICE TOTAL: ${emailData.invoiceTotal}

Payment Terms: 2% 30, Net 60

Attached: ${invoiceAttachment.filename}

---
Impact Direct - Invoice Notification
  `

  const msg = {
    to: emailTo,
    cc: emailCc,
    from: {
      email: emailFrom,
      name: emailFromName,
    },
    subject: `Invoice - ${emailData.releaseNumber} - Ship Date ${shipDateStr}`,
    text: textBody,
    html: htmlBody,
    attachments: [sgAttachment],
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid API key not configured. Invoice email would have been sent to:', emailTo)
      console.log('📧 Subject:', msg.subject)
      console.log('📎 Attachment:', invoiceAttachment.filename)
      return
    }

    await sgMail.send(msg)
    console.log(`✅ Invoice email sent successfully to: ${emailTo}, CC: ${emailCc.join(', ')}`)
  } catch (error) {
    console.error('❌ Error sending invoice email:', error)
    throw error
  }
}
