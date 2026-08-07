
import { Injectable } from '@angular/core';
import {
    delay,
    Observable,
    of,
} from 'rxjs';

import {
    AuthorStudioDashboard,
} from '../domain/author-studio.models';
import {
    AuthorStudioRepository,
} from '../domain/author-studio.repository';
import {
    AUTHOR_STUDIO_MOCK,
} from '../mock/author-studio.mock';

@Injectable()
export class AuthorStudioMockRepository
    implements AuthorStudioRepository {
    getDashboard():
        Observable<AuthorStudioDashboard> {
        return of(
            AUTHOR_STUDIO_MOCK,
        ).pipe(
            delay(250),
        );
    }
}