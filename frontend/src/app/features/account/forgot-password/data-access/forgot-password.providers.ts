
import { Provider } from '@angular/core';

import { ForgotPasswordRepository } from '../domain/forgot-password.repository';
import { ForgotPasswordMockRepository } from './forgot-password-mock.repository';

export function provideForgotPassword():
    Provider[] {
    return [
        {
            provide: ForgotPasswordRepository,
            useClass: ForgotPasswordMockRepository,
        },
    ];
}