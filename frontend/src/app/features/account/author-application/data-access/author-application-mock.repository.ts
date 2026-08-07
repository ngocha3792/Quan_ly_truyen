import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationResult,
} from '../domain/author-application.models';
import { AuthorApplicationRepository } from '../domain/author-application.repository';
import {
  AUTHOR_APPLICATION_CONFIG_MOCK,
  AUTHOR_APPLICATION_RESULT_MOCK,
} from '../mock/author-application.mock';

@Injectable()
export class AuthorApplicationMockRepository implements AuthorApplicationRepository {
  getConfig(): Observable<AuthorApplicationConfig> {
    return of(AUTHOR_APPLICATION_CONFIG_MOCK).pipe(delay(250));
  }

  saveDraft(draft: AuthorApplicationDraft): Observable<void> {
    console.info('[AuthorApplicationMockRepository] Draft:', draft);

    return of(undefined).pipe(delay(450));
  }

  submit(payload: AuthorApplicationPayload): Observable<AuthorApplicationResult> {
    console.info('[AuthorApplicationMockRepository] Submit:', payload);

    return of({
      ...AUTHOR_APPLICATION_RESULT_MOCK,
      applicationId: `AUTHOR-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    }).pipe(delay(900));
  }
}
