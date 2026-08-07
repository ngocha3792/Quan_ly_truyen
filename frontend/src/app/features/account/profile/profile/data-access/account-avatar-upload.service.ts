import {
    HttpClient,
    HttpHeaders,
} from '@angular/common/http';

import {
    inject,
    Injectable,
} from '@angular/core';

import {
    map,
    Observable,
    switchMap,
} from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';

import {
    CloudinaryUploadResponse,
    ConfirmedMedia,
    MediaUploadIntent,
} from '../domain/account-profile.models';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

@Injectable({
    providedIn: 'root',
})
export class AccountAvatarUploadService {
    private readonly http = inject(HttpClient);
    private readonly config = inject(APP_RUNTIME_CONFIG);

    uploadAvatar(
        userId: string,
        file: File,
    ): Observable<ConfirmedMedia> {
        this.validateFile(file);

        return this.createIntent(userId, file).pipe(
            switchMap((intent) =>
                this.uploadToCloudinary(
                    intent,
                    file,
                ).pipe(
                    switchMap((cloudinaryResult) =>
                        this.confirmUpload(
                            intent,
                            cloudinaryResult,
                        ),
                    ),
                ),
            ),
        );
    }

    private createIntent(
        userId: string,
        file: File,
    ): Observable<MediaUploadIntent> {
        const headers = new HttpHeaders({
            'x-idempotency-key': crypto.randomUUID(),
        });

        return this.http
            .post<ApiSuccessEnvelope<MediaUploadIntent>>(
                `${this.config.apiBaseUrl}/media/upload-intents`,
                {
                    purpose: 'AVATAR',
                    ownerId: userId,
                    originalName: file.name,
                    declaredMimeType: file.type,
                    declaredSizeBytes: file.size,
                },
                { headers },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    private uploadToCloudinary(
        intent: MediaUploadIntent,
        file: File,
    ): Observable<CloudinaryUploadResponse> {
        const formData = new FormData();

        formData.append('file', file);
        formData.append('api_key', intent.apiKey);
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

        /*
         * uploadUrl là URL Cloudinary bên ngoài API.
         * apiInterceptor sẽ không gắn access token vào request này.
         */
        return this.http.post<CloudinaryUploadResponse>(
            intent.uploadUrl,
            formData,
        );
    }

    private confirmUpload(
        intent: MediaUploadIntent,
        result: CloudinaryUploadResponse,
    ): Observable<ConfirmedMedia> {
        return this.http
            .post<ApiSuccessEnvelope<ConfirmedMedia>>(
                [
                    this.config.apiBaseUrl,
                    '/media/upload-intents/',
                    intent.mediaAssetId,
                    '/confirm',
                ].join(''),
                {
                    publicId: result.public_id,
                    version: result.version,
                    signature: result.signature,
                    resourceType: result.resource_type,
                },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    private validateFile(file: File): void {
        if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
            throw new Error(
                'Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.',
            );
        }

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            throw new Error(
                'Ảnh đại diện không được lớn hơn 5 MB.',
            );
        }
    }
}