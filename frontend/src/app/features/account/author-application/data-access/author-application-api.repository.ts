import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { catchError, defer, from, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { getApiErrorCode } from '../../../../core/http/api-error.util';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationRecord,
  ConfirmedApplicationMedia,
} from '../domain/author-application.models';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationUploadService } from './author-application-upload.service';

interface NormalizedAuthorApplicationDraft {
  readonly penName: string | null;
  readonly fullName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly portfolioUrl: string | null;
  readonly primaryGenre: string | null;
  readonly experience: string | null;
  readonly introduction: string | null;
  readonly firstWorkSynopsis: string | null;
  readonly acceptedTerms: boolean;
}

interface AuthorApplicationFileIdentity {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly sha256: string;
}

interface AuthorApplicationOperationIdentity {
  readonly normalizedDraft: NormalizedAuthorApplicationDraft;
  readonly file: AuthorApplicationFileIdentity;
}

interface ConfirmedSampleRetryCache {
  readonly applicationId: string;

  readonly operationIdentity: AuthorApplicationOperationIdentity;

  readonly media: ConfirmedApplicationMedia;

  readonly submitIdempotencyKey: string;
}

@Injectable()
export class AuthorApplicationApiRepository implements AuthorApplicationRepository {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly upload = inject(AuthorApplicationUploadService);

  private readonly baseUrl = `${this.config.apiBaseUrl}/author-applications`;

  private confirmedSampleRetryCache: ConfirmedSampleRetryCache | null = null;
  private ambiguousSubmitRetryCache: ConfirmedSampleRetryCache | null = null;

  private readonly fileContentHashCache = new WeakMap<File, Promise<string>>();

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
    /*
     * Phải đọc file để SHA-256 nên operation identity là async.
     *
     * defer giúp chỉ hash khi Observable thực sự
     * được subscribe.
     */
    return defer(() => from(this.createOperationIdentity(payload))).pipe(
      switchMap((operationIdentity) => {
        const retryCache = this.resolveAmbiguousSubmitRetryCache(operationIdentity);

        /*
         * Chỉ direct replay nếu:
         *
         * - normalized form giống operation cũ
         * - file content SHA-256 giống operation cũ
         */
        if (retryCache) {
          return this.submitConfirmedApplication(retryCache.applicationId, retryCache);
        }

        /*
         * Payload hiện tại khác operation đang ambiguous.
         *
         * Không được reuse idempotency key cũ.
         */
        this.ambiguousSubmitRetryCache = null;

        const draft = createDraftFromPayload(payload);

        return this.saveDraft(draft).pipe(
          switchMap((application) =>
            this.resolveConfirmedSample(
              application.applicationId,
              payload.sampleFile,
              operationIdentity,
            ).pipe(
              switchMap((cache) =>
                this.submitConfirmedApplication(application.applicationId, cache),
              ),
            ),
          ),
        );
      }),
    );
  }

  private async createOperationIdentity(
    payload: AuthorApplicationPayload,
  ): Promise<AuthorApplicationOperationIdentity> {
    const sha256 = await this.resolveFileContentSha256(payload.sampleFile);

    return {
      normalizedDraft: normalizeDraft(payload),

      file: {
        name: payload.sampleFile.name,
        type: payload.sampleFile.type,
        size: payload.sampleFile.size,
        sha256,
      },
    };
  }

  private resolveFileContentSha256(file: File): Promise<string> {
    const cached = this.fileContentHashCache.get(file);

    if (cached) {
      return cached;
    }

    const pending = sha256File(file).catch((error: unknown) => {
      // Không cache failed promise.
      this.fileContentHashCache.delete(file);

      throw error;
    });

    this.fileContentHashCache.set(file, pending);

    return pending;
  }

  private resolveAmbiguousSubmitRetryCache(
    operationIdentity: AuthorApplicationOperationIdentity,
  ): ConfirmedSampleRetryCache | null {
    const cached = this.ambiguousSubmitRetryCache;

    if (!cached) {
      return null;
    }

    return sameOperationIdentity(cached.operationIdentity, operationIdentity) ? cached : null;
  }

  private resolveConfirmedSample(
    applicationId: string,
    file: File,
    operationIdentity: AuthorApplicationOperationIdentity,
  ): Observable<ConfirmedSampleRetryCache> {
    const cached = this.confirmedSampleRetryCache;

    /*
     * Cùng application
     * + cùng file content
     *
     * => media cũ vẫn dùng được.
     */
    if (
      cached &&
      cached.applicationId === applicationId &&
      sameFileIdentity(cached.operationIdentity.file, operationIdentity.file)
    ) {
      /*
       * Form + file đều giống.
       *
       * Đây chính xác là operation cũ.
       */
      if (sameOperationIdentity(cached.operationIdentity, operationIdentity)) {
        return of(cached);
      }

      /*
       * File giống nhưng form thay đổi.
       *
       * Không upload lại file.
       *
       * Nhưng đây là business operation mới,
       * bắt buộc tạo idempotency key mới.
       */
      const nextCache: ConfirmedSampleRetryCache = {
        applicationId,

        operationIdentity,

        media: cached.media,

        submitIdempotencyKey: crypto.randomUUID(),
      };

      this.confirmedSampleRetryCache = nextCache;

      return of(nextCache);
    }

    /*
     * File content thực sự thay đổi
     * hoặc application khác.
     *
     * => upload sample mới.
     */
    return this.upload.uploadSample(applicationId, file).pipe(
      map((media) => {
        const nextCache: ConfirmedSampleRetryCache = {
          applicationId,

          operationIdentity,

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
           * Đã nhận được response success => operation có kết quả xác định,
           * có thể clear toàn bộ retry state.
           */
          if (
            this.confirmedSampleRetryCache?.applicationId === applicationId &&
            this.confirmedSampleRetryCache.submitIdempotencyKey === cache.submitIdempotencyKey
          ) {
            this.confirmedSampleRetryCache = null;
          }

          if (
            this.ambiguousSubmitRetryCache?.applicationId === applicationId &&
            this.ambiguousSubmitRetryCache.submitIdempotencyKey === cache.submitIdempotencyKey
          ) {
            this.ambiguousSubmitRetryCache = null;
          }
        }),

        catchError((error: unknown) => {
          /*
           * Chỉ bật direct replay khi client không thể biết chắc
           * backend đã commit hay chưa.
           *
           * status = 0:
           *   network/browser failure
           *
           * 408:
           *   request timeout, backend có thể vẫn đã xử lý
           *
           * 5xx:
           *   có thể lỗi xảy ra sau khi business transaction commit
           *
           * IDEMPOTENCY_CONFLICT:
           *   request cùng key vẫn đang PROCESSING, phải giữ key cũ
           */
          if (isAmbiguousSubmitFailure(error)) {
            this.ambiguousSubmitRetryCache = cache;
          } else if (
            this.ambiguousSubmitRetryCache?.submitIdempotencyKey === cache.submitIdempotencyKey
          ) {
            /*
             * Với lỗi xác định như validation 400/403/422...
             * không cần direct replay nữa.
             */
            this.ambiguousSubmitRetryCache = null;
          }

          return throwError(() => error);
        }),
      );
  }
}

function createDraftFromPayload(payload: AuthorApplicationPayload): AuthorApplicationDraft {
  return {
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
}

function normalizeDraft(
  draft: AuthorApplicationDraft | AuthorApplicationPayload,
): NormalizedAuthorApplicationDraft {
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

function sameOperationIdentity(
  left: AuthorApplicationOperationIdentity,
  right: AuthorApplicationOperationIdentity,
): boolean {
  return (
    sameNormalizedDraft(left.normalizedDraft, right.normalizedDraft) &&
    sameFileIdentity(left.file, right.file)
  );
}

function sameNormalizedDraft(
  left: NormalizedAuthorApplicationDraft,
  right: NormalizedAuthorApplicationDraft,
): boolean {
  return (
    left.penName === right.penName &&
    left.fullName === right.fullName &&
    left.email === right.email &&
    left.phone === right.phone &&
    left.portfolioUrl === right.portfolioUrl &&
    left.primaryGenre === right.primaryGenre &&
    left.experience === right.experience &&
    left.introduction === right.introduction &&
    left.firstWorkSynopsis === right.firstWorkSynopsis &&
    left.acceptedTerms === right.acceptedTerms
  );
}

function sameFileIdentity(
  left: AuthorApplicationFileIdentity,
  right: AuthorApplicationFileIdentity,
): boolean {
  return (
    left.name === right.name &&
    left.type === right.type &&
    left.size === right.size &&
    left.sha256 === right.sha256
  );
}

async function sha256File(file: File): Promise<string> {
  const content = await file.arrayBuffer();

  const digest = await crypto.subtle.digest('SHA-256', content);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isAmbiguousSubmitFailure(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  return (
    error.status === 0 ||
    error.status === 408 ||
    error.status >= 500 ||
    (error.status === 409 && getApiErrorCode(error) === 'IDEMPOTENCY_CONFLICT')
  );
}
