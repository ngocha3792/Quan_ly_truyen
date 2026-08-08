import { HttpClient, HttpHeaders } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable, of, switchMap, tap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationRecord,
  ConfirmedApplicationMedia,
} from '../domain/author-application.models';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationUploadService } from './author-application-upload.service';

interface ConfirmedSampleRetryCache {
  readonly applicationId: string;

  readonly fileFingerprint: string;

  readonly media: ConfirmedApplicationMedia;

  /**
   * Reuse cùng idempotency key
   * cho cùng business submit.
   *
   * Nếu backend đã commit nhưng
   * response bị mất, request retry
   * có thể replay kết quả cũ.
   */
  readonly submitIdempotencyKey: string;
}

@Injectable()
export class AuthorApplicationApiRepository implements AuthorApplicationRepository {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly upload = inject(AuthorApplicationUploadService);

  private readonly baseUrl = `${this.config.apiBaseUrl}/author-applications`;

  private confirmedSampleRetryCache: ConfirmedSampleRetryCache | null = null;

  getConfig(): Observable<AuthorApplicationConfig> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorApplicationConfig>>(`${this.baseUrl}/config`)
      .pipe(map((response) => response.data));
  }

  getMine(): Observable<AuthorApplicationRecord | null> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorApplicationRecord | null>>(`${this.baseUrl}/me`)
      .pipe(map((response) => response.data));
  }

  saveDraft(draft: AuthorApplicationDraft): Observable<AuthorApplicationRecord> {
    return this.http
      .put<ApiSuccessEnvelope<AuthorApplicationRecord>>(
        `${this.baseUrl}/me/draft`,

        normalizeDraft(draft),
      )
      .pipe(map((response) => response.data));
  }

  submit(payload: AuthorApplicationPayload): Observable<AuthorApplicationRecord> {
    const draft: AuthorApplicationDraft = {
      penName: payload.penName,

      fullName: payload.fullName,

      email: payload.email,

      phone: payload.phone,

      portfolioUrl: payload.portfolioUrl,

      primaryGenre: payload.primaryGenre,

      experience: payload.experience,

      introduction: payload.introduction,

      firstWorkSynopsis: payload.firstWorkSynopsis,

      acceptedTerms: payload.acceptedTerms,

      sampleFileName: payload.sampleFile.name,
    };

    /*
     * Luôn save draft trước:
     *
     * - đảm bảo application tồn tại;
     * - đảm bảo data text mới nhất
     *   được persist trước submit.
     */
    return this.saveDraft(draft).pipe(
      switchMap((application) =>
        this.resolveConfirmedSample(
          application.applicationId,

          payload.sampleFile,
        ).pipe(
          switchMap((cache) =>
            this.submitConfirmedApplication(
              application.applicationId,

              cache,
            ),
          ),
        ),
      ),
    );
  }

  private resolveConfirmedSample(
    applicationId: string,

    file: File,
  ): Observable<ConfirmedSampleRetryCache> {
    const fileFingerprint = createFileFingerprint(file);

    const cached = this.confirmedSampleRetryCache;

    /*
     * Retry đúng application
     * + đúng file:
     *
     * không upload Cloudinary lại.
     */
    if (
      cached &&
      cached.applicationId === applicationId &&
      cached.fileFingerprint === fileFingerprint
    ) {
      return of(cached);
    }

    /*
     * File mới hoặc application mới:
     * tạo upload mới.
     */
    return this.upload
      .uploadSample(
        applicationId,

        file,
      )
      .pipe(
        map((media) => {
          const nextCache: ConfirmedSampleRetryCache = {
            applicationId,

            fileFingerprint,

            media,

            submitIdempotencyKey: crypto.randomUUID(),
          };

          this.confirmedSampleRetryCache = nextCache;

          return nextCache;
        }),
      );
  }

  private submitConfirmedApplication(
    applicationId: string,

    cache: ConfirmedSampleRetryCache,
  ): Observable<AuthorApplicationRecord> {
    const headers = new HttpHeaders({
      'x-idempotency-key': cache.submitIdempotencyKey,
    });

    return this.http
      .post<ApiSuccessEnvelope<AuthorApplicationRecord>>(
        `${this.baseUrl}/me/submit`,

        {
          applicationId,

          sampleMediaId: cache.media.id,
        },

        {
          headers,
        },
      )
      .pipe(
        map((response) => response.data),

        tap(() => {
          /*
           * Chỉ clear sau submit success.
           *
           * Error/network failure:
           * giữ cache để retry.
           */
          if (
            this.confirmedSampleRetryCache?.applicationId === applicationId &&
            this.confirmedSampleRetryCache.submitIdempotencyKey === cache.submitIdempotencyKey
          ) {
            this.confirmedSampleRetryCache = null;
          }
        }),
      );
  }
}

function normalizeDraft(draft: AuthorApplicationDraft) {
  return {
    penName: optionalText(draft.penName),

    fullName: optionalText(draft.fullName),

    email: optionalText(draft.email),

    phone: optionalText(draft.phone),

    portfolioUrl: optionalText(draft.portfolioUrl),

    primaryGenre: optionalText(draft.primaryGenre),

    experience: optionalText(draft.experience),

    introduction: optionalText(draft.introduction),

    firstWorkSynopsis: optionalText(draft.firstWorkSynopsis),

    acceptedTerms: draft.acceptedTerms,
  };
}

function optionalText(value: string): string | null {
  const normalized = value.trim();

  return normalized || null;
}

function createFileFingerprint(file: File): string {
  return [file.name, file.type, file.size, file.lastModified].join('|');
}
