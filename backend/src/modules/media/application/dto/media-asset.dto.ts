import type { MediaPurposeName } from './media-purpose.dto';
export interface MediaAssetDto {
  readonly id: string;
  readonly uploaderId: string | null;
  readonly purpose: MediaPurposeName | string;
  readonly status: string;
  readonly publicId: string | null;
  readonly resourceType: string | null;
  readonly format: string | null;
  readonly secureUrl: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly sizeBytes: bigint | null;
  readonly readyAt: Date | null;
  readonly uploadExpiresAt?: Date | null;
}
export interface CreateMediaUploadIntentInput {
  readonly principal: import('@/common/interfaces/auth').AuthPrincipal;
  readonly purpose: MediaPurposeName;
  readonly ownerId: string;
  readonly originalName: string;
  readonly declaredMimeType: string;
  readonly declaredSizeBytes: number;
}
export interface CleanupSummary {
  scanned: number;
  deleted: number;
  failed: number;
  skipped: number;
}
export interface MediaCleanupOptions {
  batchSize?: number;
  olderThan?: Date;
}
