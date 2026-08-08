import { HttpClient, HttpHeaders } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable, switchMap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationRecord,
} from '../domain/author-application.models';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationUploadService } from './author-application-upload.service';

@Injectable()
export class AuthorApplicationApiRepository implements AuthorApplicationRepository {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly upload = inject(AuthorApplicationUploadService);

  private readonly baseUrl = `${this.config.apiBaseUrl}/author-applications`;

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
     * Flow cố ý:
     *
     * 1. persist draft → có applicationId
     * 2. upload ATTACHMENT với ownerId=applicationId
     * 3. submit application với sampleMediaId
     */
    return this.saveDraft(draft).pipe(
      switchMap((application) =>
        this.upload
          .uploadSample(
            application.applicationId,

            payload.sampleFile,
          )
          .pipe(
            switchMap((media) =>
              this.http.post<ApiSuccessEnvelope<AuthorApplicationRecord>>(
                `${this.baseUrl}/me/submit`,

                {
                  applicationId: application.applicationId,

                  sampleMediaId: media.id,
                },

                {
                  headers: new HttpHeaders({
                    'x-idempotency-key': crypto.randomUUID(),
                  }),
                },
              ),
            ),
          ),
      ),

      map((response) => response.data),
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
