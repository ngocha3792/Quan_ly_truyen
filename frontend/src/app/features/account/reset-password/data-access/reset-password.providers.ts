import { Provider } from '@angular/core';

import { ResetPasswordRepository } from '../domain/reset-password.repository';
import { ResetPasswordHttpRepository } from './reset-password-http.repository';

export function provideResetPassword(): Provider[] {
  return [
    {
      provide: ResetPasswordRepository,

      useClass: ResetPasswordHttpRepository,
    },
  ];
}
