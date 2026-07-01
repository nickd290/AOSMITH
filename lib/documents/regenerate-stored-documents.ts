import { savePackingSlip } from '@/lib/documents/packing-slip'
import { saveBoxLabels } from '@/lib/documents/box-labels'
import {
  buildBoxLabelData,
  buildPackingSlipData,
  type ReleaseWithPartAndLocation,
} from '@/lib/documents/release-document-data'

export async function regenerateStoredReleaseDocuments(
  releaseId: string,
  release: ReleaseWithPartAndLocation,
): Promise<{ packingSlipUrl: string | null; boxLabelsUrl: string | null }> {
  let packingSlipUrl: string | null = null
  let boxLabelsUrl: string | null = null

  try {
    packingSlipUrl = await savePackingSlip(
      releaseId,
      buildPackingSlipData(release),
    )
    boxLabelsUrl = await saveBoxLabels(releaseId, buildBoxLabelData(release))
  } catch (error) {
    console.warn(
      `⚠️ Document regeneration failed for ${release.releaseNumber}:`,
      error,
    )
  }

  return { packingSlipUrl, boxLabelsUrl }
}