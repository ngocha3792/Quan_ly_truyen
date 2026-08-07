import { Observable } from 'rxjs';

import {
  ResetPasswordConfig,
  ResetPasswordRequest,
  ResetPasswordResult,
  ResetPasswordTokenRequest,
  ResetPasswordTokenValidation,
} from './reset-password.models';

export abstract class ResetPasswordRepository {
  abstract getConfig(): Observable<ResetPasswordConfig>;

  abstract validateToken(
    request: ResetPasswordTokenRequest,
  ): Observable<ResetPasswordTokenValidation>;

  abstract resetPassword(request: ResetPasswordRequest): Observable<ResetPasswordResult>;
}
