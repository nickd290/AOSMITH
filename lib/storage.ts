import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2 Configuration
// R2 is S3-compatible, so we use the AWS SDK with R2 endpoints
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "inventory-release-pdfs";
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL || "";

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a PDF buffer to Cloudflare R2 storage
 * @param buffer PDF file buffer
 * @param fileName File name (e.g., "packing-slip-12345.pdf")
 * @param contentType MIME type (default: "application/pdf")
 * @returns Public URL and storage key
 */
export async function uploadPDF(
  buffer: Buffer,
  fileName: string,
  contentType: string = "application/pdf"
): Promise<UploadResult> {
  // Generate unique key with timestamp
  const timestamp = Date.now();
  const key = `pdfs/${timestamp}-${fileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Make publicly accessible if R2 bucket is configured for public access
      // Alternatively, use signed URLs for private access
    });

    await r2Client.send(command);

    // Construct public URL
    // Format: https://<bucket-name>.<account-id>.r2.cloudflarestorage.com/<key>
    // Or use custom domain if configured
    const url = PUBLIC_URL_BASE
      ? `${PUBLIC_URL_BASE}/${key}`
      : `https://${BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;

    return { url, key };
  } catch (error) {
    console.error("Error uploading PDF to R2:", error);
    throw new Error(`Failed to upload PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Upload packing slip PDF to R2
 * @param pdfBuffer PDF buffer from jsPDF
 * @param releaseNumber Release identifier for file naming
 * @returns Public URL to the PDF
 */
export async function uploadPackingSlip(
  pdfBuffer: Buffer,
  releaseNumber: string
): Promise<string> {
  const fileName = `packing-slip-${releaseNumber}.pdf`;
  const result = await uploadPDF(pdfBuffer, fileName);
  return result.url;
}

/**
 * Upload box labels PDF to R2
 * @param pdfBuffer PDF buffer from jsPDF
 * @param releaseNumber Release identifier for file naming
 * @returns Public URL to the PDF
 */
export async function uploadBoxLabels(
  pdfBuffer: Buffer,
  releaseNumber: string
): Promise<string> {
  const fileName = `box-labels-${releaseNumber}.pdf`;
  const result = await uploadPDF(pdfBuffer, fileName);
  return result.url;
}

/**
 * Upload invoice PDF to R2
 * @param pdfBuffer PDF buffer from jsPDF
 * @param releaseNumber Release identifier for file naming
 * @returns Public URL to the PDF
 */
export async function uploadInvoice(
  pdfBuffer: Buffer,
  releaseNumber: string
): Promise<string> {
  const fileName = `invoice-${releaseNumber}.pdf`;
  const result = await uploadPDF(pdfBuffer, fileName);
  return result.url;
}

/**
 * Check if R2 storage is properly configured
 * @returns true if all required environment variables are set
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Get the R2 configuration status for debugging
 */
export function getR2Status() {
  return {
    configured: isR2Configured(),
    endpoint: !!process.env.R2_ENDPOINT,
    accessKeyId: !!process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
    bucketName: !!process.env.R2_BUCKET_NAME,
    publicUrl: !!process.env.R2_PUBLIC_URL,
  };
}
