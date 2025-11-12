import JsBarcode from 'jsbarcode'
import { createCanvas } from 'canvas'

/**
 * Generate a Code 128 barcode and return as base64 data URL
 * @param value - The value to encode in the barcode
 * @param options - Optional barcode configuration
 * @returns Base64 data URL of the barcode image
 */
export function generateBarcode(
  value: string,
  options: {
    width?: number
    height?: number
    displayValue?: boolean
    fontSize?: number
    margin?: number
  } = {}
): string {
  const {
    width = 2,
    height = 40,
    displayValue = false,
    fontSize = 12,
    margin = 5,
  } = options

  // Create a canvas
  const canvas = createCanvas(200, 100)

  // Generate barcode
  JsBarcode(canvas, value, {
    format: 'CODE128',
    width,
    height,
    displayValue,
    fontSize,
    margin,
    background: '#ffffff',
    lineColor: '#000000',
  })

  // Return as base64 data URL
  return canvas.toDataURL('image/png')
}

/**
 * Generate a barcode with the value displayed below
 * @param value - The value to encode
 * @param options - Optional configuration
 * @returns Base64 data URL
 */
export function generateBarcodeWithValue(
  value: string,
  options: {
    width?: number
    height?: number
    fontSize?: number
  } = {}
): string {
  return generateBarcode(value, {
    ...options,
    displayValue: true,
  })
}
