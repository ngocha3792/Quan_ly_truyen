import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

type ProfileMediaPurpose = 'AVATAR' | 'AUTHOR_BANNER';

interface UploadIntent {
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

export interface ConfirmedProfileMedia {
  readonly id: string;
  readonly deliveryUrl: string | null;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable({ providedIn: 'root' })
export class AuthorProfileUploadService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  upload(ownerId: string, file: File, purpose: ProfileMediaPurpose): Observable<ConfirmedProfileMedia> {
    this.validate(file, purpose);
    return this.createIntent(ownerId, file, purpose).pipe(
      switchMap((intent) =>
        this.uploadCloudinary(intent, file).pipe(
          switchMap((result) => this.confirm(intent, result)),
        ),
      ),
    );
  }

  private createIntent(ownerId: string, file: File, purpose: ProfileMediaPurpose): Observable<UploadIntent> {
    return this.http
      .post<ApiSuccessEnvelope<UploadIntent>>(
        `${this.config.apiBaseUrl}/media/upload-intents`,
        {
          purpose,
          ownerId,
          originalName: file.name,
          declaredMimeType: file.type,
          declaredSizeBytes: file.size,
        },
        { headers: new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() }) },
      )
      .pipe(map((response) => response.data));
  }

  private uploadCloudinary(intent: UploadIntent, file: File): Observable<CloudinaryUploadResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', intent.apiKey);
    form.append('timestamp', String(intent.timestamp));
    form.append('signature', intent.signature);
    form.append('upload_preset', intent.parameters.upload_preset);
    form.append('public_id', intent.parameters.public_id);
    form.append('asset_folder', intent.parameters.asset_folder);
    form.append('overwrite', String(intent.parameters.overwrite));
    form.append('tags', intent.parameters.tags);
    return this.http.post<CloudinaryUploadResponse>(intent.uploadUrl, form);
  }

  private confirm(intent: UploadIntent, result: CloudinaryUploadResponse): Observable<ConfirmedProfileMedia> {
    return this.http
      .post<ApiSuccessEnvelope<ConfirmedProfileMedia>>(
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

  private validate(file: File, purpose: ProfileMediaPurpose): void {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    const max = purpose === 'AVATAR' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > max) throw new Error(purpose === 'AVATAR' ? 'Avatar tối đa 5 MB.' : 'Banner tối đa 10 MB.');
  }
}
