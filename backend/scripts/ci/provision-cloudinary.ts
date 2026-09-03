import { v2 as cloudinary } from 'cloudinary';
import { config as loadEnvironment } from 'dotenv';
import path from 'node:path';

import {
  CLOUDINARY_DEFAULTS,
  CLOUDINARY_UPLOAD_PRESET_DEFAULTS,
} from '@/common/constants';
import { MEDIA_UPLOAD_POLICIES } from '@/modules/media/domain/policies/media-upload-policy.registry';

const MB = 1024 * 1024;

interface PresetDefinition {
  envName: string;
  fallbackName: string;
  allowedFormats: readonly string[];
  maxFileSize: number;
}

const presetDefinitions: PresetDefinition[] = [
  {
    envName: 'CLOUDINARY_AVATAR_UPLOAD_PRESET',
    fallbackName: CLOUDINARY_UPLOAD_PRESET_DEFAULTS.AVATAR,
    allowedFormats: MEDIA_UPLOAD_POLICIES.AVATAR.allowedFormats,
    maxFileSize: MEDIA_UPLOAD_POLICIES.AVATAR.maxBytes,
  },
  {
    envName: 'CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET',
    fallbackName: CLOUDINARY_UPLOAD_PRESET_DEFAULTS.AUTHOR_BANNER,
    allowedFormats: MEDIA_UPLOAD_POLICIES.AUTHOR_BANNER.allowedFormats,
    maxFileSize: MEDIA_UPLOAD_POLICIES.AUTHOR_BANNER.maxBytes,
  },
  {
    envName: 'CLOUDINARY_STORY_COVER_UPLOAD_PRESET',
    fallbackName: CLOUDINARY_UPLOAD_PRESET_DEFAULTS.STORY_COVER,
    allowedFormats: MEDIA_UPLOAD_POLICIES.STORY_COVER.allowedFormats,
    maxFileSize: MEDIA_UPLOAD_POLICIES.STORY_COVER.maxBytes,
  },
  {
    envName: 'CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET',
    fallbackName: CLOUDINARY_UPLOAD_PRESET_DEFAULTS.CHAPTER_IMAGE,
    allowedFormats: MEDIA_UPLOAD_POLICIES.CHAPTER_IMAGE.allowedFormats,
    maxFileSize: MEDIA_UPLOAD_POLICIES.CHAPTER_IMAGE.maxBytes,
  },
  {
    envName: 'CLOUDINARY_ATTACHMENT_UPLOAD_PRESET',
    fallbackName: CLOUDINARY_UPLOAD_PRESET_DEFAULTS.ATTACHMENT,
    allowedFormats: MEDIA_UPLOAD_POLICIES.ATTACHMENT.allowedFormats,
    maxFileSize: MEDIA_UPLOAD_POLICIES.ATTACHMENT.maxBytes,
  },
];

const envFile = readArgument('--env-file=') ?? '.env.production';
loadEnvironment({ path: path.resolve(process.cwd(), envFile) });

const apply = process.argv.includes('--apply');
const cloudName = requireVariable('CLOUDINARY_CLOUD_NAME');
const apiKey = requireVariable('CLOUDINARY_API_KEY');
const apiSecret = requireVariable('CLOUDINARY_API_SECRET');
const webhookUrl = resolveWebhookUrl();

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
  signature_algorithm:
    process.env.CLOUDINARY_SIGNATURE_ALGORITHM === 'sha1'
      ? 'sha1'
      : CLOUDINARY_DEFAULTS.SIGNATURE_ALGORITHM,
});

async function main(): Promise<void> {
  const presets = presetDefinitions.map((definition) => ({
    ...definition,
    name: process.env[definition.envName]?.trim() || definition.fallbackName,
  }));

  console.info(`Cloudinary product environment: ${cloudName}`);
  console.info(`Webhook URL: ${webhookUrl}`);
  for (const preset of presets) {
    console.info(
      `${apply ? 'Apply' : 'Would apply'} signed preset ${preset.name}: ` +
        `${preset.allowedFormats.join(', ')}, max ${preset.maxFileSize / MB} MiB`,
    );
  }

  if (!apply) {
    console.info('Dry run only. Re-run with --apply to change Cloudinary.');
    return;
  }

  await cloudinary.api.ping();

  for (const preset of presets) {
    const options = {
      unsigned: false,
      disallow_public_id: false,
      overwrite: false,
      use_filename: false,
      unique_filename: true,
      allowed_formats: preset.allowedFormats,
      max_file_size: preset.maxFileSize,
      notification_url: webhookUrl,
    };

    if (await presetExists(preset.name)) {
      await cloudinary.api.update_upload_preset(preset.name, options);
      console.info(`Updated ${preset.name}`);
    } else {
      await cloudinary.api.create_upload_preset({
        name: preset.name,
        ...options,
      });
      console.info(`Created ${preset.name}`);
    }
  }

  console.info('Cloudinary signed upload presets provisioned successfully.');
}

async function presetExists(name: string): Promise<boolean> {
  try {
    await cloudinary.api.upload_preset(name);
    return true;
  } catch (error: unknown) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    http_code?: unknown;
    error?: { http_code?: unknown };
  };
  return candidate.http_code === 404 || candidate.error?.http_code === 404;
}

function resolveWebhookUrl(): string {
  const explicit = process.env.CLOUDINARY_WEBHOOK_URL?.trim();
  const base = process.env.APP_PUBLIC_URL?.trim();
  const value =
    explicit ||
    (base ? `${base.replace(/\/$/, '')}/api/v1/webhooks/cloudinary` : '');

  if (!value) {
    throw new Error(
      'CLOUDINARY_WEBHOOK_URL or APP_PUBLIC_URL is required to configure upload notifications',
    );
  }

  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error('Cloudinary webhook URL must use HTTPS');
  }
  return parsed.toString();
}

function readArgument(prefix: string): string | undefined {
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in ${envFile}`);
  return value;
}

void main().catch((error: unknown) => {
  console.error(
    'Cloudinary provisioning failed',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
});
