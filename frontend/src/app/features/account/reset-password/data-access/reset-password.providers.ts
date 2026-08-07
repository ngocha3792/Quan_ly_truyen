
import { Provider } from '@angular/core';

import {
    ResetPasswordRepository,
} from '../domain/reset-password.repository';
import {
    ResetPasswordMockRepository,
} from './reset-password-mock.repository';

export function provideResetPassword():
    Provider[] {
    return [
        {
            provide:
                ResetPasswordRepository,

            useClass:
                ResetPasswordMockRepository,
        },
    ];
}