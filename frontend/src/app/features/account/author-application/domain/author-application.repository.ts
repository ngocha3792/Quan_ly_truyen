
import { Observable } from 'rxjs';

import {
    AuthorApplicationConfig,
    AuthorApplicationDraft,
    AuthorApplicationPayload,
    AuthorApplicationResult,
} from './author-application.models';

export abstract class AuthorApplicationRepository {
    abstract getConfig():
        Observable<AuthorApplicationConfig>;

    abstract saveDraft(
        draft: AuthorApplicationDraft,
    ): Observable<void>;

    abstract submit(
        payload: AuthorApplicationPayload,
    ): Observable<AuthorApplicationResult>;
}