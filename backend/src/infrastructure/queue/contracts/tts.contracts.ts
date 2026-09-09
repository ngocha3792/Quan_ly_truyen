export const GENERATE_TTS_MANIFEST_JOB = 'tts.generate-manifest.v1';

export interface GenerateTtsManifestJobV1 {
  readonly version: 1;
  readonly manifestId: string;
}

export function isGenerateTtsManifestJobV1(
  value: unknown,
): value is GenerateTtsManifestJobV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['version'] === 1 &&
    typeof (value as Record<string, unknown>)['manifestId'] === 'string'
  );
}
