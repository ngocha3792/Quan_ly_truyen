import { Observable } from 'rxjs';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationRecord,
} from './author-application.models';

export abstract class AuthorApplicationRepository {
  abstract getConfig(): Observable<AuthorApplicationConfig>;

  abstract getMine(): Observable<AuthorApplicationRecord | null>;

  abstract saveDraft(draft: AuthorApplicationDraft): Observable<AuthorApplicationRecord>;

  abstract submit(payload: AuthorApplicationPayload): Observable<AuthorApplicationRecord>;
}
