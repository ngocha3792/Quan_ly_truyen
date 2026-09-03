import { v2 as cloudinary } from 'cloudinary';
import { config as loadEnvironment } from 'dotenv';
import path from 'node:path';
import { CLOUDINARY_UPLOAD_PRESET_DEFAULTS } from '@/common/constants';

const envFile =
  process.argv
    .find((argument) => argument.startsWith('--env-file='))
    ?.slice('--env-file='.length) ?? '.env';
loadEnvironment({ path: path.resolve(process.cwd(), envFile) });

async function main(): Promise<void> {
  if (process.env.CLOUDINARY_ENABLED !== 'true') {
    console.info('Cloudinary verification skipped: CLOUDINARY_ENABLED=false');
    return;
  }
  const cloudName = requireVariable('CLOUDINARY_CLOUD_NAME');
  const apiKey = requireVariable('CLOUDINARY_API_KEY');
  const apiSecret = requireVariable('CLOUDINARY_API_SECRET');
  const expected = [
    process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET?.trim() ||
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.AVATAR,
    process.env.CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET?.trim() ||
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.AUTHOR_BANNER,
    process.env.CLOUDINARY_STORY_COVER_UPLOAD_PRESET?.trim() ||
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.STORY_COVER,
    process.env.CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET?.trim() ||
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.CHAPTER_IMAGE,
    process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET?.trim() ||
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.ATTACHMENT,
  ];
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  await cloudinary.api.ping();
  const response: unknown = await cloudinary.api.upload_presets({
    max_results: 500,
  });
  const presets = new Map(
    getPresetList(response).map((preset) => [preset.name, preset]),
  );
  for (const name of expected) {
    const preset = presets.get(name);
    if (!preset) throw new Error(`Missing Cloudinary upload preset: ${name}`);
    if (preset.unsigned === true)
      throw new Error(`Cloudinary upload preset must be signed: ${name}`);
  }
  console.info(
    `Cloudinary credentials and ${expected.length} signed presets verified`,
  );
  console.warn(
    'Verify allowed formats, maximum file size and Dynamic Folder Mode manually in Cloudinary Console; Admin API does not expose every security setting consistently.',
  );
}

function getPresetList(
  value: unknown,
): Array<{ name: string; unsigned?: boolean }> {
  if (
    !value ||
    typeof value !== 'object' ||
    !('presets' in value) ||
    !Array.isArray(value.presets)
  ) {
    throw new Error('Cloudinary returned an invalid upload preset response');
  }
  return value.presets.filter(isUploadPreset);
}

function isUploadPreset(
  value: unknown,
): value is { name: string; unsigned?: boolean } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    (record.unsigned === undefined || typeof record.unsigned === 'boolean')
  );
}

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in ${envFile}`);
  return value;
}

void main().catch((error: unknown) => {
  console.error(
    'Cloudinary verification failed',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
});
