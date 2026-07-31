export const GENERATE_COVER_VARIANTS_JOB = 'media.generate-cover-variants.v1';

export interface GenerateCoverVariantsJobV1 {
  version: 1;
  mediaAssetId: string;
  correlationId?: string;
}
