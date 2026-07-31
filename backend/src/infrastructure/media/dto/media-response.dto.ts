import type { MediaAsset } from '@/generated/prisma/client';

export interface MediaResponseDto {
  id: string;
  purpose: string;
  status: string;
  resourceType: string | null;
  format: string | null;
  secureUrl: string | null;
  deliveryUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: string | null;
  readyAt: string | null;
}

export function toMediaResponse(
  media: MediaAsset,
  deliveryUrl: string | null,
): MediaResponseDto {
  return {
    id: media.id,
    purpose: media.purpose,
    status: media.status,
    resourceType: media.resourceType,
    format: media.format,
    secureUrl: media.resourceType === 'RAW' ? media.secureUrl : null,
    deliveryUrl,
    width: media.width,
    height: media.height,
    sizeBytes: media.sizeBytes?.toString() ?? null,
    readyAt: media.readyAt?.toISOString() ?? null,
  };
}
