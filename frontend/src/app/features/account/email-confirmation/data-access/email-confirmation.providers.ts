
import { Provider } from '@angular/core';

import {
    EmailConfirmationRepository,
} from '../domain/email-confirmation.repository';
import {
    EmailConfirmationMockRepository,
} from './email-confirmation-mock.repository';

export function provideEmailConfirmation():
    Provider[] {
    return [
        {
            provide: EmailConfirmationRepository,
            useClass:
                EmailConfirmationMockRepository,
        },
    ];
}