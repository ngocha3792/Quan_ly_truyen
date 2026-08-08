import { HttpClient, HttpHeaders } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable, switchMap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
  CloudinaryUploadResponse,
  ConfirmedApplicationMedia,
  MediaUploadIntent,
} from '../domain/author-application.models';

@Injectable({
  providedIn: 'root',
})
export class AuthorApplicationUploadService {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  uploadSample(
    applicationId: string,

    file: File,
  ): Observable<ConfirmedApplicationMedia> {
    return this.createIntent(
      applicationId,

      file,
    ).pipe(
      switchMap((intent) =>
        this.uploadToCloudinary(
          intent,

          file,
        ).pipe(
          switchMap((result) =>
            this.confirm(
              intent,

              result,
            ),
          ),
        ),
      ),
    );
  }

  private createIntent(
    applicationId: string,

    file: File,
  ): Observable<MediaUploadIntent> {
    return this.http
      .post<ApiSuccessEnvelope<MediaUploadIntent>>(
        `${this.config.apiBaseUrl}/media/upload-intents`,

        {
          purpose: 'AUTHOR_APPLICATION_SAMPLE',

          ownerId: applicationId,

          originalName: file.name,

          declaredMimeType: resolveMimeType(file),

          declaredSizeBytes: file.size,
        },

        {
          headers: new HttpHeaders({
            'x-idempotency-key': crypto.randomUUID(),
          }),
        },
      )
      .pipe(map((response) => response.data));
  }

  private uploadToCloudinary(
    intent: MediaUploadIntent,

    file: File,
  ): Observable<CloudinaryUploadResponse> {
    const formData = new FormData();

    formData.append(
      'file',

      file,
    );

    formData.append(
      'api_key',

      intent.apiKey,
    );

    formData.append(
      'timestamp',

      String(intent.timestamp),
    );

    formData.append(
      'signature',

      intent.signature,
    );

    formData.append(
      'upload_preset',

      intent.parameters.upload_preset,
    );

    formData.append(
      'public_id',

      intent.parameters.public_id,
    );

    formData.append(
      'asset_folder',

      intent.parameters.asset_folder,
    );

    formData.append(
      'overwrite',

      String(intent.parameters.overwrite),
    );

    formData.append(
      'tags',

      intent.parameters.tags,
    );

    return this.http.post<CloudinaryUploadResponse>(
      intent.uploadUrl,

      formData,
    );
  }

  private confirm(
    intent: MediaUploadIntent,

    result: CloudinaryUploadResponse,
  ): Observable<ConfirmedApplicationMedia> {
    return this.http
      .post<ApiSuccessEnvelope<ConfirmedApplicationMedia>>(
        [this.config.apiBaseUrl, '/media/upload-intents/', intent.mediaAssetId, '/confirm'].join(
          '',
        ),

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

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function resolveMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }

  switch (getExtension(file.name)) {
    case 'pdf':
      return 'application/pdf';

    case 'txt':
      return 'text/plain';

    case 'doc':
      return 'application/msword';

    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    default:
      return 'application/octet-stream';
  }
}
