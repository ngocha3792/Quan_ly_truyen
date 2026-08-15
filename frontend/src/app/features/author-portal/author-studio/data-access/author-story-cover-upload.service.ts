import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AuthorStoryMedia } from '../domain/author-story-management.models';

interface StoryCoverUploadIntent {
  readonly mediaAssetId: string;
  readonly uploadUrl: string;
  readonly apiKey: string;
  readonly signature: string;
  readonly timestamp: number;
  readonly parameters: {
    readonly upload_preset: string;
    readonly public_id: string;
    readonly asset_folder: string;
    readonly overwrite: boolean;
    readonly tags: string;
  };
}

interface CloudinaryStoryCoverUploadResponse {
  readonly public_id: string;
  readonly version: number;
  readonly signature: string;
  readonly resource_type: 'image' | 'video' | 'raw';
}

@Injectable()
export class AuthorStoryCoverUploadService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  upload(storyId: string, file: File): Observable<AuthorStoryMedia> {
    return this.createIntent(storyId, file).pipe(
      switchMap((intent: StoryCoverUploadIntent) =>
        this.uploadToCloudinary(intent, file).pipe(
          switchMap((result: CloudinaryStoryCoverUploadResponse) => this.confirm(intent, result)),
        ),
      ),
    );
  }

  private createIntent(storyId: string, file: File): Observable<StoryCoverUploadIntent> {
    return this.http
      .post<ApiSuccessEnvelope<StoryCoverUploadIntent>>(
        `${this.config.apiBaseUrl}/media/upload-intents`,
        {
          purpose: 'STORY_COVER',
          ownerId: storyId,
          originalName: file.name,
          declaredMimeType: resolveImageMimeType(file),
          declaredSizeBytes: file.size,
        },
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response: ApiSuccessEnvelope<StoryCoverUploadIntent>) => response.data));
  }

  private uploadToCloudinary(
    intent: StoryCoverUploadIntent,
    file: File,
  ): Observable<CloudinaryStoryCoverUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', intent.apiKey);
    formData.append('timestamp', String(intent.timestamp));
    formData.append('signature', intent.signature);
    formData.append('upload_preset', intent.parameters.upload_preset);
    formData.append('public_id', intent.parameters.public_id);
    formData.append('asset_folder', intent.parameters.asset_folder);
    formData.append('overwrite', String(intent.parameters.overwrite));
    formData.append('tags', intent.parameters.tags);

    return this.http.post<CloudinaryStoryCoverUploadResponse>(intent.uploadUrl, formData);
  }

  private confirm(
    intent: StoryCoverUploadIntent,
    result: CloudinaryStoryCoverUploadResponse,
  ): Observable<AuthorStoryMedia> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorStoryMedia>>(
        `${this.config.apiBaseUrl}/media/upload-intents/${intent.mediaAssetId}/confirm`,
        {
          publicId: result.public_id,
          version: result.version,
          signature: result.signature,
          resourceType: result.resource_type,
        },
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorStoryMedia>) => response.data));
  }
}

function resolveImageMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

function idempotencyHeaders(): HttpHeaders {
  return new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() });
}
