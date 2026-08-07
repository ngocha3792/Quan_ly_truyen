import { Provider } from '@angular/core';

import { EmailConfirmationRepository } from '../domain/email-confirmation.repository';
import { EmailConfirmationHttpRepository } from './email-confirmation-http.repository';

export function provideEmailConfirmation(): Provider[] {
  return [
    {
      provide: EmailConfirmationRepository,

      useClass: EmailConfirmationHttpRepository,
    },
  ];
}
