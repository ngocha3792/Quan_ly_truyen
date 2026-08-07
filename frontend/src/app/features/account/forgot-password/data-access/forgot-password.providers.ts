import { Provider } from '@angular/core';

import { ForgotPasswordRepository } from '../domain/forgot-password.repository';
import { ForgotPasswordHttpRepository } from './forgot-password-http.repository';

export function provideForgotPassword(): Provider[] {
  return [
    {
      provide: ForgotPasswordRepository,
      useClass: ForgotPasswordHttpRepository,
    },
  ];
}
