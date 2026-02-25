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
  notes?: string  // Special instructions (e.g., "Ship Estes Collect, heat-treated pallet")
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
                          ${emailData.notes ? `
                          <!-- Special Instructions Row -->
                          <tr>
                            <td colspan="2" style="padding: 12px 0 0 0;">
                              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 12px;">
                                <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">⚠️ Special Instructions</div>
                                <div style="font-size: 14px; color: #78350f; font-weight: 600;">${emailData.notes}</div>
                              </div>
                            </td>
                          </tr>
                          ` : ''}
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
${emailData.notes ? `
*** SPECIAL INSTRUCTIONS ***
${emailData.notes}
` : ''}
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
 * Send Three Z release notification (Email 1B)
 * To: Jenny Koester + Derek Meinhart at Three Z
 * Triggered: When a release is created (same time as Email 1 to ePrint)
 * Attachment: Box labels only
 * Key message: Ship date prominent, don't book truck until packing slip uploaded
 */
export async function sendThreeZReleaseNotification(
  emailData: ReleaseEmailData & { shipDate?: string | null },
  boxLabelsAttachment: EmailAttachment
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'EPG Release'

  const threeZTo = ['jkoester@threez.com', 'dmeinhart@threez.com']

  const sgAttachment = {
    content: boxLabelsAttachment.content || '',
    filename: boxLabelsAttachment.filename,
    type: boxLabelsAttachment.type || 'application/pdf',
    disposition: 'attachment' as const,
  }

  const shipDateStr = emailData.shipDate
    ? new Date(emailData.shipDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not set'

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
                <td style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                          Three Z &mdash; New Release
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

              <!-- Ship Date Banner (PROMINENT) -->
              <tr>
                <td style="padding: 24px; background-color: #faf5ff; border-bottom: 3px solid #7c3aed;">
                  <div style="text-align: center;">
                    <div style="font-size: 11px; color: #6b21a8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Ship Date</div>
                    <div style="font-size: 24px; color: #5b21b6; font-weight: 800;">${shipDateStr}</div>
                  </div>
                </td>
              </tr>

              <!-- Warning Banner -->
              <tr>
                <td style="padding: 16px 24px; background-color: #fef3c7; border-bottom: 2px solid #f59e0b;">
                  <div style="font-size: 14px; color: #92400e; font-weight: 700; text-align: center; line-height: 1.5;">
                    ⚠️ DO NOT book truck until packing slip is uploaded to the portal.
                  </div>
                </td>
              </tr>

              <!-- Main Content Card -->
              <tr>
                <td style="padding: 24px; background-color: #ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fafafa; border-left: 4px solid #7c3aed; border-radius: 4px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
                          <tr>
                            <td width="50%" style="padding: 12px 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Quantity</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship To</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.shippingLocation}</div>
                            </td>
                          </tr>
                          ${emailData.notes ? `
                          <tr>
                            <td colspan="2" style="padding: 12px 0 0 0;">
                              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 12px;">
                                <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Special Instructions</div>
                                <div style="font-size: 14px; color: #78350f; font-weight: 600;">${emailData.notes}</div>
                              </div>
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Attachment -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Attached Box Labels</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500;">
                          📄 ${boxLabelsAttachment.filename}
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
                    JD Graphic / Impact Direct &ndash; Three Z Release Notification
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

  const textBody = `
THREE Z — NEW RELEASE - ${emailData.releaseNumber}

*** SHIP DATE: ${shipDateStr} ***

⚠️ DO NOT book truck until packing slip is uploaded to the portal.

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT INFORMATION
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Quantity: ${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)

Ship To: ${emailData.shippingLocation}
${emailData.notes ? `\nSpecial Instructions: ${emailData.notes}` : ''}

Attached: ${boxLabelsAttachment.filename} (Box Labels)

---
JD Graphic / Impact Direct - Three Z Release Notification
  `

  const msg = {
    to: threeZTo,
    from: {
      email: emailFrom,
      name: emailFromName,
    },
    subject: `New Release - ${emailData.releaseNumber} — Ship Date: ${shipDateStr}`,
    text: textBody,
    html: htmlBody,
    attachments: [sgAttachment],
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid API key not configured. Three Z release email would have been sent to:', threeZTo.join(', '))
      console.log('📧 Subject:', msg.subject)
      return
    }

    await sgMail.send(msg)
    console.log(`✅ Three Z release email sent to: ${threeZTo.join(', ')}`)
  } catch (error) {
    console.error('❌ Error sending Three Z release email:', error)
    throw error
  }
}

/**
 * Send Three Z ship notification (Email 2B)
 * To: Jenny Koester + Derek Meinhart at Three Z
 * Triggered: When customer uploads their packing slip
 * Attachment: Customer's packing slip
 * Key message: OK to release and ship, use the attached packing slip
 */
export async function sendThreeZShipNotification(
  emailData: {
    releaseNumber: string
    customerPONumber: string
    partNumber: string
    partDescription: string
    totalUnits: number
    pallets: number
    boxes: number
    shippingLocation: string
    shipDate?: string | null
  },
  packingSlipAttachment: EmailAttachment
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'EPG Release'

  const threeZTo = ['jkoester@threez.com', 'dmeinhart@threez.com']

  const sgAttachment = {
    content: packingSlipAttachment.content || '',
    filename: packingSlipAttachment.filename,
    type: packingSlipAttachment.type || 'application/pdf',
    disposition: 'attachment' as const,
  }

  const shipDateStr = emailData.shipDate
    ? new Date(emailData.shipDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not set'

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
                <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                          Three Z &mdash; OK to Ship
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

              <!-- GO Banner -->
              <tr>
                <td style="padding: 24px; background-color: #ecfdf5; border-bottom: 3px solid #059669;">
                  <div style="font-size: 16px; color: #065f46; font-weight: 700; text-align: center; line-height: 1.5;">
                    ✅ Packing slip uploaded &mdash; OK to release and ship.<br>
                    <span style="font-size: 13px; font-weight: 600;">Use the attached packing slip from the customer.</span>
                  </div>
                </td>
              </tr>

              <!-- Ship Date -->
              <tr>
                <td style="padding: 16px 24px; background-color: #f0fdf4;">
                  <div style="text-align: center;">
                    <div style="font-size: 11px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Ship Date</div>
                    <div style="font-size: 20px; color: #14532d; font-weight: 800;">${shipDateStr}</div>
                  </div>
                </td>
              </tr>

              <!-- Main Content Card -->
              <tr>
                <td style="padding: 24px; background-color: #ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fafafa; border-left: 4px solid #059669; border-radius: 4px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
                          <tr>
                            <td width="50%" style="padding: 12px 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Quantity</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship To</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.shippingLocation}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Attachment -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Attached Customer Packing Slip</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="display: inline-block; background-color: #ecfdf5; color: #065f46; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500;">
                          📄 ${packingSlipAttachment.filename}
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
                    JD Graphic / Impact Direct &ndash; Three Z Ship Authorization
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

  const textBody = `
THREE Z — OK TO SHIP - ${emailData.releaseNumber}

✅ Packing slip uploaded — OK to release and ship.
Use the attached packing slip from the customer.

SHIP DATE: ${shipDateStr}

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT INFORMATION
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Quantity: ${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)

Ship To: ${emailData.shippingLocation}

Attached: ${packingSlipAttachment.filename} (Customer Packing Slip)

---
JD Graphic / Impact Direct - Three Z Ship Authorization
  `

  const msg = {
    to: threeZTo,
    from: {
      email: emailFrom,
      name: emailFromName,
    },
    subject: `OK to Ship - ${emailData.releaseNumber} — Packing Slip Uploaded`,
    text: textBody,
    html: htmlBody,
    attachments: [sgAttachment],
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid API key not configured. Three Z ship email would have been sent to:', threeZTo.join(', '))
      console.log('📧 Subject:', msg.subject)
      return
    }

    await sgMail.send(msg)
    console.log(`✅ Three Z ship authorization email sent to: ${threeZTo.join(', ')}`)
  } catch (error) {
    console.error('❌ Error sending Three Z ship email:', error)
    throw error
  }
}

/**
 * Send "Ready to Ship" notification when customer uploads their packing slip
 */
export async function sendPackingSlipReadyNotification(
  emailData: {
    releaseNumber: string
    customerPONumber: string
    partNumber: string
    partDescription: string
    totalUnits: number
    pallets: number
    boxes: number
    shippingLocation: string
    shipDate?: string | null
  },
  attachment: EmailAttachment
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'EPG Release'
  const emailTo = process.env.EMAIL_TO || 'nick@jdgraphic.com'
  const emailCc = process.env.EMAIL_CC || ''

  const sgAttachment = {
    content: attachment.content || '',
    filename: attachment.filename,
    type: attachment.type || 'application/pdf',
    disposition: 'attachment' as const,
  }

  const shipDateStr = emailData.shipDate
    ? new Date(emailData.shipDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not set'

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
                <td style="background: linear-gradient(135deg, #b45309 0%, #92400e 100%); padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                          Ready to Ship
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

              <!-- Message Banner -->
              <tr>
                <td style="padding: 24px; background-color: #fffbeb; border-bottom: 2px solid #f59e0b;">
                  <div style="font-size: 15px; color: #92400e; font-weight: 600; line-height: 1.5;">
                    EPrint Group has uploaded their packing slip &mdash; this release is ready to ship.
                  </div>
                </td>
              </tr>

              <!-- Main Content Card -->
              <tr>
                <td style="padding: 24px; background-color: #ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fafafa; border-left: 4px solid #b45309; border-radius: 4px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
                          <tr>
                            <td width="50%" style="padding: 12px 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Quantity</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship Date</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 600;">${shipDateStr}</div>
                            </td>
                          </tr>
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
                          <tr>
                            <td colspan="2" style="padding: 12px 0 0 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship To</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.shippingLocation}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Attachment -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Attached Customer Packing Slip</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500;">
                          ${attachment.filename}
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
                    Enterprise Print Group &ndash; Customer Packing Slip Upload Notification
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

  const textBody = `
READY TO SHIP - ${emailData.releaseNumber}

EPrint Group has uploaded their packing slip - this release is ready to ship.

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT INFORMATION
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Quantity: ${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)

SHIPPING INFORMATION
Ship To: ${emailData.shippingLocation}
Ship Date: ${shipDateStr}

Attached: ${attachment.filename}

---
Enterprise Print Group - Customer Packing Slip Upload Notification
  `

  const msg = {
    to: emailTo,
    cc: emailCc.split(',').map(email => email.trim()).filter(email => email),
    from: {
      email: emailFrom,
      name: emailFromName,
    },
    subject: `Ready to Ship - ${emailData.releaseNumber} - ${emailData.partNumber}`,
    text: textBody,
    html: htmlBody,
    attachments: [sgAttachment],
  }

  try {
    if (!apiKey) {
      console.log('SendGrid API key not configured. Ready to Ship email would have been sent to:', emailTo)
      console.log('Subject:', msg.subject)
      console.log('Attachment:', attachment.filename)
      return
    }

    await sgMail.send(msg)
    const ccList = emailCc ? `, CC: ${emailCc}` : ''
    console.log(`Ready to Ship email sent successfully to: ${emailTo}${ccList}`)
  } catch (error) {
    console.error('Error sending Ready to Ship email:', error)
    throw error
  }
}

/**
 * Send internal invoice reminder on ship date (Email 3)
 * To: john@jdgraphic.com, brenda@jdgraphic.com, crista@jdgraphic.com
 * Triggered: Cron on ship date (replaces old invoice email to ap@eprintgroup.com)
 * No attachment — just a heads-up that this job needs to be invoiced
 */
export async function sendInvoiceReminderEmail(
  emailData: ReleaseEmailData & { shipDate: Date; etaDeliveryDate?: Date | null }
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'EPG Release'

  // Internal JD team recipients
  const emailTo = ['john@jdgraphic.com', 'brenda@jdgraphic.com', 'crista@jdgraphic.com']

  const shipDateStr = emailData.shipDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
                <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 20px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        <div style="color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                          Invoice Needed
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

              <!-- Action Banner -->
              <tr>
                <td style="padding: 24px; background-color: #fef2f2; border-bottom: 2px solid #dc2626;">
                  <div style="font-size: 16px; color: #991b1b; font-weight: 700; text-align: center; line-height: 1.5;">
                    This job is shipping today and needs to be invoiced.
                  </div>
                </td>
              </tr>

              <!-- Main Content Card -->
              <tr>
                <td style="padding: 24px; background-color: #ffffff;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fafafa; border-left: 4px solid #dc2626; border-radius: 4px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
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
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
                          <tr>
                            <td width="50%" style="padding: 12px 8px 12px 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship Date</div>
                              <div style="font-size: 14px; color: #111827; font-weight: 700;">${shipDateStr}</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 12px 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Units</div>
                              <div style="font-size: 16px; color: #111827; font-weight: 700;">${emailData.totalUnits.toLocaleString()}</div>
                            </td>
                          </tr>
                          <tr><td colspan="2" style="padding: 8px 0;"><div style="height: 1px; background-color: #e5e7eb;"></div></td></tr>
                          <tr>
                            <td width="50%" style="padding: 12px 8px 0 0; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ship To</div>
                              <div style="font-size: 13px; color: #374151; line-height: 1.4;">${emailData.shippingLocation}</div>
                            </td>
                            <td width="50%" style="padding: 12px 0 0 8px; vertical-align: top;">
                              <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Invoice Amount</div>
                              <div style="font-size: 20px; color: #dc2626; font-weight: 700;">${emailData.invoiceTotal}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                  <div style="color: #6b7280; font-size: 11px; line-height: 1.5;">
                    EPG Inventory Release &ndash; Internal Invoice Reminder
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

  const textBody = `
INVOICE NEEDED - ${emailData.releaseNumber}

This job is shipping today and needs to be invoiced.

Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Ship Date: ${shipDateStr}
Total Units: ${emailData.totalUnits.toLocaleString()}
Ship To: ${emailData.shippingLocation}
Invoice Amount: ${emailData.invoiceTotal}

---
EPG Inventory Release - Internal Invoice Reminder
  `

  const msg = {
    to: emailTo,
    from: {
      email: emailFrom,
      name: emailFromName,
    },
    subject: `Invoice Needed - ${emailData.releaseNumber} - ${emailData.partNumber}`,
    text: textBody,
    html: htmlBody,
  }

  try {
    if (!apiKey) {
      console.log('SendGrid API key not configured. Invoice reminder would have been sent to:', emailTo.join(', '))
      console.log('Subject:', msg.subject)
      return
    }

    await sgMail.send(msg)
    console.log(`Invoice reminder sent to: ${emailTo.join(', ')}`)
  } catch (error) {
    console.error('Error sending invoice reminder email:', error)
    throw error
  }
}
