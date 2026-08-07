
import { Provider } from '@angular/core';

import { AuthorApplicationRepository } from '../domain/author-application.repository';
import { AuthorApplicationMockRepository } from './author-application-mock.repository';

export function provideAuthorApplication():
    Provider[] {
    return [
        {
            provide:
                AuthorApplicationRepository,

            useClass:
                AuthorApplicationMockRepository,
        },
    ];
}