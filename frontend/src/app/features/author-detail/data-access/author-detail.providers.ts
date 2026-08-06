
import { Provider } from '@angular/core';

import { AuthorDetailRepository } from '../domain/author-detail.repository';
import { AuthorDetailMockRepository } from './author-detail-mock.repository';

export function provideAuthorDetail(): Provider[] {
    return [
        {
            provide: AuthorDetailRepository,
            useClass: AuthorDetailMockRepository,
        },
    ];
}