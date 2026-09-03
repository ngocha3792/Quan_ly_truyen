import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AuthorStoryMedia } from '../domain/author-story-management.models';

const AUTHOR_MEDIA_PURPOSE = {
  storyCover: 'STORY_COVER',
  chapterImage: 'CHAPTER_IMAGE',
} as const;

interface AuthorMediaUploadIntent {
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

interface CloudinaryUploadResponse {
  readonly public_id: string;
  readonly version: number;
  readonly signature: string;
  readonly resource_type: 'image' | 'video' | 'raw';
}

@Injectable()
export class AuthorMediaUploadService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  uploadStoryCover(storyId: string, file: File): Observable<AuthorStoryMedia> {
    return this.upload(AUTHOR_MEDIA_PURPOSE.storyCover, storyId, file);
  }

  uploadChapterImage(chapterId: string, file: File): Observable<AuthorStoryMedia> {
    return this.upload(AUTHOR_MEDIA_PURPOSE.chapterImage, chapterId, file);
  }

  private upload(
    purpose: (typeof AUTHOR_MEDIA_PURPOSE)[keyof typeof AUTHOR_MEDIA_PURPOSE],
    ownerId: string,
    file: File,
  ): Observable<AuthorStoryMedia> {
    return this.createIntent(purpose, ownerId, file).pipe(
      switchMap((intent) =>
        this.uploadToCloudinary(intent, file).pipe(
          switchMap((result) => this.confirm(intent, result)),
        ),
      ),
    );
  }

  private createIntent(
    purpose: (typeof AUTHOR_MEDIA_PURPOSE)[keyof typeof AUTHOR_MEDIA_PURPOSE],
    ownerId: string,
    file: File,
  ): Observable<AuthorMediaUploadIntent> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorMediaUploadIntent>>(
        `${this.config.apiBaseUrl}/media/upload-intents`,
        {
          purpose,
          ownerId,
          originalName: file.name,
          declaredMimeType: resolveImageMimeType(file),
          declaredSizeBytes: file.size,
        },
        { headers: new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() }) },
      )
      .pipe(map((response) => response.data));
  }

  private uploadToCloudinary(
    intent: AuthorMediaUploadIntent,
    file: File,
  ): Observable<CloudinaryUploadResponse> {
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
    return this.http.post<CloudinaryUploadResponse>(intent.uploadUrl, formData);
  }

  private confirm(
    intent: AuthorMediaUploadIntent,
    result: CloudinaryUploadResponse,
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
      .pipe(map((response) => response.data));
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
