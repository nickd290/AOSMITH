import sgMail from '@sendgrid/mail'
import * as fs from 'fs'
import { EPG_SHIP_TO, EPG_DEFAULT_CARRIER } from '../epg'

// Initialize SendGrid
const apiKey = process.env.SENDGRID_API_KEY || ''
if (apiKey) {
  sgMail.setApiKey(apiKey)
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://inventory-release-app-production.up.railway.app'

export interface EmailAttachment {
  filename: string
  filePath?: string      // File path to read from (legacy)
  content?: string       // Base64 content directly (preferred)
  type?: string
}

export interface ReleaseEmailData {
  releaseNumber: string
  releaseId?: string             // Used for deep links into the IRA portal
  partNumber: string
  partDescription: string
  pallets: number
  boxes: number
  totalUnits: number
  customerPONumber: string
  shippingLocation: string       // Display string — usually EPG Knoxville, ignored under new process
  invoiceTotal: string
  notes?: string                 // Special instructions
  shipDate?: string | null
  skidType?: 'WOOD' | 'HEAT_TREATED'
}

function formatSkidTypeLabel(value?: 'WOOD' | 'HEAT_TREATED'): string {
  if (value === 'HEAT_TREATED') return 'Heat-Treated'
  if (value === 'WOOD') return 'Wood'
  return '—'
}

const EPG_SHIP_TO_LINE = `${EPG_SHIP_TO.name}, ${EPG_SHIP_TO.address}, ${EPG_SHIP_TO.city}, ${EPG_SHIP_TO.state} ${EPG_SHIP_TO.zip}`

function formatShipDate(shipDate?: string | null): string {
  if (!shipDate) return 'Not set'
  return new Date(shipDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function buildDeepLinks(releaseId?: string): {
  paperworkUrl: string
  portalUrl: string
  markShippedUrl: string
} {
  const portalUrl = `${APP_URL}/history${releaseId ? `?openRelease=${releaseId}` : ''}`
  const paperworkUrl = releaseId
    ? `${APP_URL}/api/releases/${releaseId}/jd-paperwork`
    : `${APP_URL}/history`
  const markShippedUrl = `${APP_URL}/history${releaseId ? `?markShip=${releaseId}` : ''}`
  return { paperworkUrl, portalUrl, markShippedUrl }
}

function attachmentsToSendgrid(
  attachments: EmailAttachment[],
): Array<{ content: string; filename: string; type: string; disposition: string }> {
  return attachments
    .map((att) => {
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
    })
    .filter(Boolean) as Array<{ content: string; filename: string; type: string; disposition: string }>
}

/**
 * Send release notification email (Email 1) to JD team when Alecia creates a release.
 *
 * Apr 2026 EPG new process: includes JD packing slip + AOS box labels as attachments,
 * three deep links to the IRA portal (paperwork / view release / mark shipped),
 * and the canonical EPG Knoxville ship-to. NO more "wait for packing slip" gate.
 */
export async function sendReleaseNotification(
  emailData: ReleaseEmailData,
  attachments: EmailAttachment[],
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'JD Graphic'
  const emailTo = process.env.EMAIL_TO || 'nick@jdgraphic.com'
  const emailCc = process.env.EMAIL_CC || ''

  const { paperworkUrl, portalUrl, markShippedUrl } = buildDeepLinks(emailData.releaseId)
  const shipDateStr = formatShipDate(emailData.shipDate)
  const sgAttachments = attachmentsToSendgrid(attachments)

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:20px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#1a1e2e 0%,#0f1320 100%);padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;"><div style="color:#fff;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">📦 New Release — JD Ships</div></td>
<td align="right" style="vertical-align:middle;"><div style="color:#fff;font-size:16px;font-weight:700;">${emailData.releaseNumber}</div></td>
</tr></table></td></tr>

<!-- Ship Date Banner -->
<tr><td style="padding:18px 24px;background-color:#f5f0eb;border-bottom:3px solid #1a1e2e;text-align:center;">
<div style="font-size:11px;color:#1a1e2e;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Ship Date</div>
<div style="font-size:22px;color:#0f1320;font-weight:800;">${shipDateStr}</div>
</td></tr>

<!-- Process Banner -->
<tr><td style="padding:14px 24px;background-color:#fefce8;border-bottom:1px solid #facc15;">
<div style="font-size:13px;color:#713f12;font-weight:600;text-align:center;line-height:1.5;">
📋 JD generates own paperwork. Ship to <strong>${EPG_SHIP_TO.name}, ${EPG_SHIP_TO.city} ${EPG_SHIP_TO.state}</strong>.<br>
Carrier: <strong>${EPG_DEFAULT_CARRIER}</strong> on JD account (manual phone booking). Apply attached AOS box labels.
</div>
</td></tr>

<!-- Details Grid -->
<tr><td style="padding:24px;background-color:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-left:4px solid #c45a2c;border-radius:4px;"><tr><td style="padding:16px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="50%" style="padding:0 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Release Number</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.releaseNumber}</div></td>
<td width="50%" style="padding:0 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Customer PO #</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.customerPONumber}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Part Number</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.partNumber}</div></td>
<td width="50%" style="padding:12px 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Description</div><div style="font-size:13px;color:#374151;line-height:1.4;">${emailData.partDescription}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Quantity</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)</div></td>
<td width="50%" style="padding:12px 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Invoice Total</div><div style="font-size:14px;color:#111827;font-weight:700;">${emailData.invoiceTotal}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Skid Type</div><div style="font-size:14px;color:#111827;font-weight:700;">${formatSkidTypeLabel(emailData.skidType)}</div></td>
<td width="50%" style="padding:12px 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Ship To</div><div style="font-size:13px;color:#111827;font-weight:600;line-height:1.4;">${EPG_SHIP_TO_LINE}</div></td>
</tr>
${
  emailData.notes
    ? `<tr><td colspan="2" style="padding:12px 0 0 0;"><div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:12px;"><div style="font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚠️ Special Instructions</div><div style="font-size:14px;color:#78350f;font-weight:600;">${emailData.notes}</div></div></td></tr>`
    : ''
}
</table>
</td></tr></table>
</td></tr>

<!-- Action Buttons -->
<tr><td style="padding:0 24px 24px 24px;">
<div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Quick Actions</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="padding:6px;text-align:center;"><a href="${paperworkUrl}" style="display:inline-block;background-color:#1a1e2e;color:#fff;padding:12px 18px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">📄 JD Packing Slip + BOL</a></td>
<td style="padding:6px;text-align:center;"><a href="${portalUrl}" style="display:inline-block;background-color:#c45a2c;color:#fff;padding:12px 18px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">🏷️ View Release / Box Labels</a></td>
<td style="padding:6px;text-align:center;"><a href="${markShippedUrl}" style="display:inline-block;background-color:#15803d;color:#fff;padding:12px 18px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">✅ Mark Shipped</a></td>
</tr></table>
</td></tr>

<!-- Attachments -->
${
  attachments.length > 0
    ? `<tr><td style="padding:0 24px 24px 24px;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Attached</div><table role="presentation" cellpadding="0" cellspacing="0" border="0">${attachments.map((att) => `<tr><td style="padding:4px 0;"><span style="display:inline-block;background-color:#f3f4f6;color:#374151;padding:6px 12px;border-radius:4px;font-size:13px;font-weight:500;">📄 ${att.filename}</span></td></tr>`).join('')}</table></td></tr>`
    : ''
}

<!-- Footer -->
<tr><td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
<div style="color:#6b7280;font-size:11px;line-height:1.5;">JD Graphic, Co Inc — Inventory Release System<br><a href="${portalUrl}" style="color:#6b7280;">Open in portal</a></div>
</td></tr>

</table></td></tr></table></body></html>`

  const textBody = `
NEW RELEASE — JD SHIPS — ${emailData.releaseNumber}

Ship Date: ${shipDateStr}

JD generates own paperwork. Ship to ${EPG_SHIP_TO_LINE}.
Carrier: ${EPG_DEFAULT_CARRIER} on JD account (manual phone booking).
Apply attached AOS box labels.

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT INFORMATION
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Quantity: ${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)
Skid Type: ${formatSkidTypeLabel(emailData.skidType)}

SHIPPING INFORMATION
Ship To: ${EPG_SHIP_TO_LINE}
Carrier: ${EPG_DEFAULT_CARRIER} (JD account)
${emailData.notes ? `\n*** SPECIAL INSTRUCTIONS ***\n${emailData.notes}\n` : ''}
Invoice Total: ${emailData.invoiceTotal}

QUICK ACTIONS
- JD Packing Slip + BOL: ${paperworkUrl}
- View Release / Box Labels: ${portalUrl}
- Mark Shipped: ${markShippedUrl}

Attached: ${attachments.map((a) => a.filename).join(', ') || '(none)'}

---
JD Graphic, Co Inc — Inventory Release System
  `

  const msg = {
    to: emailTo,
    cc: emailCc.split(',').map((e) => e.trim()).filter((e) => e),
    from: { email: emailFrom, name: emailFromName },
    subject: `New Release — JD Ships — ${emailData.releaseNumber}`,
    text: textBody,
    html: htmlBody,
    attachments: sgAttachments,
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid not configured. Email would have been sent to:', emailTo)
      console.log('📧 Subject:', msg.subject)
      console.log('📎 Attachments:', attachments.map((a) => a.filename).join(', '))
      return
    }
    await sgMail.send(msg)
    const ccList = emailCc ? `, CC: ${emailCc}` : ''
    console.log(`✅ Email sent to: ${emailTo}${ccList}`)
  } catch (error) {
    console.error('❌ Error sending email:', error)
    throw error
  }
}

/**
 * Send Three Z release notification (Email 1B) when Alecia creates a release.
 *
 * Three Z holds part of the EPG inventory. They get the same alert so they can
 * coordinate with JD on who ships from which yard. Apr 2026: removed the
 * "DO NOT book truck until packing slip uploaded" gate — JD ships now, Three Z
 * coordinates with JD via reply if they're holding the inventory.
 */
export async function sendThreeZReleaseNotification(
  emailData: ReleaseEmailData,
  boxLabelsAttachment: EmailAttachment,
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'JD Graphic'
  const threeZTo = ['jkoester@threez.com', 'dmeinhart@threez.com']

  const sgAttachment = {
    content: boxLabelsAttachment.content || '',
    filename: boxLabelsAttachment.filename,
    type: boxLabelsAttachment.type || 'application/pdf',
    disposition: 'attachment' as const,
  }
  const { portalUrl } = buildDeepLinks(emailData.releaseId)
  const shipDateStr = formatShipDate(emailData.shipDate)

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:20px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">

<tr><td style="background:linear-gradient(135deg,#1a1e2e 0%,#0f1320 100%);padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;"><div style="color:#fff;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Three Z &mdash; New Release</div></td>
<td align="right" style="vertical-align:middle;"><div style="color:#fff;font-size:16px;font-weight:700;">${emailData.releaseNumber}</div></td>
</tr></table></td></tr>

<tr><td style="padding:24px;background-color:#f0f4f8;border-bottom:3px solid #1a1e2e;text-align:center;">
<div style="font-size:11px;color:#1a1e2e;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Ship Date</div>
<div style="font-size:24px;color:#0f1320;font-weight:800;">${shipDateStr}</div>
</td></tr>

<tr><td style="padding:14px 24px;background-color:#fefce8;border-bottom:1px solid #facc15;">
<div style="font-size:13px;color:#713f12;font-weight:600;text-align:center;line-height:1.5;">
📋 Ship to <strong>${EPG_SHIP_TO.name}, ${EPG_SHIP_TO.city} ${EPG_SHIP_TO.state}</strong>.<br>
Coordinate with JD on who ships (whoever has the most pallets). Carrier = <strong>${EPG_DEFAULT_CARRIER}</strong> on JD account.<br>
JD generates own paperwork — no need to wait on EPG.
</div>
</td></tr>

<tr><td style="padding:24px;background-color:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-left:4px solid #1a1e2e;border-radius:4px;"><tr><td style="padding:16px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="50%" style="padding:0 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Release Number</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.releaseNumber}</div></td>
<td width="50%" style="padding:0 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Customer PO #</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.customerPONumber}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Part Number</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.partNumber}</div></td>
<td width="50%" style="padding:12px 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Description</div><div style="font-size:13px;color:#374151;">${emailData.partDescription}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Quantity</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)</div></td>
<td width="50%" style="padding:12px 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Skid Type</div><div style="font-size:14px;color:#111827;font-weight:700;">${formatSkidTypeLabel(emailData.skidType)}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td colspan="2" style="padding:12px 0 0 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Ship To</div><div style="font-size:13px;color:#111827;font-weight:600;line-height:1.4;">${EPG_SHIP_TO_LINE}</div></td>
</tr>
${
  emailData.notes
    ? `<tr><td colspan="2" style="padding:12px 0 0 0;"><div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:12px;"><div style="font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Special Instructions</div><div style="font-size:14px;color:#78350f;font-weight:600;">${emailData.notes}</div></div></td></tr>`
    : ''
}
</table>
</td></tr></table>
</td></tr>

<tr><td style="padding:0 24px 24px 24px;">
<div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Attached AOS Box Labels</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:4px 0;"><span style="display:inline-block;background-color:#f3f4f6;color:#374151;padding:6px 12px;border-radius:4px;font-size:13px;font-weight:500;">📄 ${boxLabelsAttachment.filename}</span></td></tr></table>
<div style="margin-top:14px;"><a href="${portalUrl}" style="display:inline-block;background-color:#c45a2c;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">View Release in Portal →</a></div>
</td></tr>

<tr><td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
<div style="color:#6b7280;font-size:11px;line-height:1.5;">JD Graphic / Impact Direct &ndash; Three Z Release Notification</div>
</td></tr>

</table></td></tr></table></body></html>`

  const textBody = `
THREE Z — NEW RELEASE — ${emailData.releaseNumber}

SHIP DATE: ${shipDateStr}

Ship to ${EPG_SHIP_TO_LINE}.
Carrier = ${EPG_DEFAULT_CARRIER} on JD account.
Coordinate with JD on who ships (whoever has the most pallets).
JD generates own paperwork — no need to wait on EPG.

RELEASE DETAILS
Release Number: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}

PRODUCT
Part Number: ${emailData.partNumber}
Description: ${emailData.partDescription}
Quantity: ${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)
Skid Type: ${formatSkidTypeLabel(emailData.skidType)}

Ship To: ${EPG_SHIP_TO_LINE}
${emailData.notes ? `\nSpecial Instructions: ${emailData.notes}` : ''}

Attached: ${boxLabelsAttachment.filename} (AOS Box Labels)
View Release: ${portalUrl}

---
JD Graphic / Impact Direct - Three Z Release Notification
  `

  const msg = {
    to: threeZTo,
    from: { email: emailFrom, name: emailFromName },
    subject: `New Release - ${emailData.releaseNumber} — Ship Date: ${shipDateStr}`,
    text: textBody,
    html: htmlBody,
    attachments: [sgAttachment],
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid not configured. Three Z release email would have been sent to:', threeZTo.join(', '))
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
 * Send shipment confirmation email when admin clicks Mark Shipped.
 *
 * Apr 2026 EPG new process: replaces the old "customer uploaded packing slip
 * → ready to ship" pair of emails. Goes to Alecia (cc Kirk + JD team) once the
 * shipment is on the truck and the FedEx Freight PRO# is known.
 */
export async function sendShipConfirmationEmail(emailData: {
  releaseNumber: string
  releaseId?: string
  customerPONumber: string
  partNumber: string
  partDescription: string
  totalUnits: number
  pallets: number
  boxes: number
  proNumber: string
  carrier: string
  shippedAt: Date
}): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'JD Graphic'

  const epgPrimary = (process.env.EPG_SHIP_TO_EMAIL || 'abates@eprintgroup.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const epgCc = (process.env.EPG_CC_EMAIL || 'kicuss@eprintgroup.com,mwelker@eprintgroup.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const internalCc = (process.env.EMAIL_TO || 'nick@jdgraphic.com,brenda@jdgraphic.com,devin@jdgraphic.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const { portalUrl } = buildDeepLinks(emailData.releaseId)
  const shippedDateStr = emailData.shippedAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:20px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">

<tr><td style="background:linear-gradient(135deg,#15803d 0%,#166534 100%);padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;"><div style="color:#fff;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">✅ Shipment Confirmed</div></td>
<td align="right" style="vertical-align:middle;"><div style="color:#fff;font-size:16px;font-weight:700;">${emailData.releaseNumber}</div></td>
</tr></table></td></tr>

<tr><td style="padding:24px;background-color:#ecfdf5;border-bottom:3px solid #15803d;text-align:center;">
<div style="font-size:11px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">PRO #</div>
<div style="font-size:28px;color:#14532d;font-weight:800;letter-spacing:1px;">${emailData.proNumber}</div>
<div style="font-size:13px;color:#166534;margin-top:8px;">${emailData.carrier} &mdash; shipped ${shippedDateStr}</div>
</td></tr>

<tr><td style="padding:24px;background-color:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border-left:4px solid #15803d;border-radius:4px;"><tr><td style="padding:16px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="50%" style="padding:0 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Release Number</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.releaseNumber}</div></td>
<td width="50%" style="padding:0 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Customer PO #</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.customerPONumber}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 12px 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Part Number</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.partNumber}</div></td>
<td width="50%" style="padding:12px 0 12px 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Description</div><div style="font-size:13px;color:#374151;">${emailData.partDescription}</div></td>
</tr>
<tr><td colspan="2" style="padding:8px 0;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
<tr>
<td width="50%" style="padding:12px 8px 0 0;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Quantity</div><div style="font-size:14px;color:#111827;font-weight:600;">${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)</div></td>
<td width="50%" style="padding:12px 0 0 8px;vertical-align:top;"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Shipped To</div><div style="font-size:13px;color:#111827;font-weight:600;line-height:1.4;">${EPG_SHIP_TO_LINE}</div></td>
</tr>
</table>
</td></tr></table>
</td></tr>

<tr><td style="padding:0 24px 24px 24px;text-align:center;">
<a href="${portalUrl}" style="display:inline-block;background-color:#1a1e2e;color:#fff;padding:12px 24px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">View Release in Portal →</a>
</td></tr>

<tr><td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
<div style="color:#6b7280;font-size:11px;line-height:1.5;">JD Graphic, Co Inc &mdash; Shipment Confirmation</div>
</td></tr>

</table></td></tr></table></body></html>`

  const textBody = `
SHIPMENT CONFIRMED — ${emailData.releaseNumber}

PRO #: ${emailData.proNumber}
Carrier: ${emailData.carrier}
Shipped: ${shippedDateStr}

Release: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}
Part: ${emailData.partNumber} — ${emailData.partDescription}
Quantity: ${emailData.pallets} pallets, ${emailData.boxes} boxes (${emailData.totalUnits.toLocaleString()} units)
Shipped To: ${EPG_SHIP_TO_LINE}

View Release: ${portalUrl}

---
JD Graphic, Co Inc — Shipment Confirmation
  `

  const msg = {
    to: epgPrimary,
    cc: [...epgCc, ...internalCc],
    from: { email: emailFrom, name: emailFromName },
    subject: `Shipped — ${emailData.releaseNumber} — PRO ${emailData.proNumber}`,
    text: textBody,
    html: htmlBody,
  }

  try {
    if (!apiKey) {
      console.log('⚠️ SendGrid not configured. Ship confirmation would have been sent to:', epgPrimary.join(', '))
      console.log('📧 Subject:', msg.subject)
      return
    }
    await sgMail.send(msg)
    console.log(`✅ Ship confirmation sent to: ${epgPrimary.join(', ')} (cc ${[...epgCc, ...internalCc].join(', ')})`)
  } catch (error) {
    console.error('❌ Error sending ship confirmation:', error)
    throw error
  }
}

/**
 * Send internal invoice reminder on ship date (Email 3).
 * Triggered: Cron on ship date (replaces old invoice email to ap@eprintgroup.com).
 */
export async function sendInvoiceReminderEmail(
  emailData: Omit<ReleaseEmailData, 'shipDate'> & { shipDate: Date; etaDeliveryDate?: Date | null },
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@jdgraphic.com'
  const emailFromName = process.env.EMAIL_FROM_NAME || 'JD Graphic'
  const emailTo = ['john@jdgraphic.com', 'brenda@jdgraphic.com', 'crista@jdgraphic.com']

  const shipDateStr = emailData.shipDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:20px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="vertical-align:middle;"><div style="color:#fff;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Invoice Needed</div></td>
<td align="right" style="vertical-align:middle;"><div style="color:#fff;font-size:16px;font-weight:700;">${emailData.releaseNumber}</div></td>
</tr></table></td></tr>
<tr><td style="padding:24px;background-color:#fef2f2;border-bottom:2px solid #dc2626;text-align:center;">
<div style="font-size:16px;color:#991b1b;font-weight:700;line-height:1.5;">This job is shipping today and needs to be invoiced.</div>
</td></tr>
<tr><td style="padding:24px;background-color:#ffffff;">
<div style="font-size:14px;line-height:1.6;color:#111827;">
<strong>Release:</strong> ${emailData.releaseNumber}<br>
<strong>Customer PO #:</strong> ${emailData.customerPONumber}<br>
<strong>Part:</strong> ${emailData.partNumber} &mdash; ${emailData.partDescription}<br>
<strong>Ship Date:</strong> ${shipDateStr}<br>
<strong>Total Units:</strong> ${emailData.totalUnits.toLocaleString()}<br>
<strong>Ship To:</strong> ${EPG_SHIP_TO_LINE}<br>
<strong>Invoice Amount:</strong> <span style="font-size:18px;color:#dc2626;font-weight:700;">${emailData.invoiceTotal}</span>
</div>
</td></tr>
<tr><td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
<div style="color:#6b7280;font-size:11px;">JD Graphic, Co Inc &mdash; Internal Invoice Reminder</div>
</td></tr>
</table></td></tr></table></body></html>`

  const textBody = `
INVOICE NEEDED - ${emailData.releaseNumber}

This job is shipping today and needs to be invoiced.

Release: ${emailData.releaseNumber}
Customer PO #: ${emailData.customerPONumber}
Part: ${emailData.partNumber} — ${emailData.partDescription}
Ship Date: ${shipDateStr}
Total Units: ${emailData.totalUnits.toLocaleString()}
Ship To: ${EPG_SHIP_TO_LINE}
Invoice Amount: ${emailData.invoiceTotal}

---
JD Graphic, Co Inc - Internal Invoice Reminder
  `

  const msg = {
    to: emailTo,
    from: { email: emailFrom, name: emailFromName },
    subject: `Invoice Needed - ${emailData.releaseNumber} - ${emailData.partNumber}`,
    text: textBody,
    html: htmlBody,
  }

  try {
    if (!apiKey) {
      console.log('SendGrid not configured. Invoice reminder would have been sent to:', emailTo.join(', '))
      return
    }
    await sgMail.send(msg)
    console.log(`Invoice reminder sent to: ${emailTo.join(', ')}`)
  } catch (error) {
    console.error('Error sending invoice reminder email:', error)
    throw error
  }
}
