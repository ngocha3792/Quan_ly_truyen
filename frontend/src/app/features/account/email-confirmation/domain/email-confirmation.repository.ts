import { Observable } from 'rxjs';

import { EmailConfirmationRequest, EmailConfirmationResult } from './email-confirmation.models';

export abstract class EmailConfirmationRepository {
  abstract confirmEmail(request: EmailConfirmationRequest): Observable<EmailConfirmationResult>;
}
