
import { Observable } from 'rxjs';

import {
    ForgotPasswordRequest,
    ForgotPasswordResult,
} from './forgot-password.models';

export abstract class ForgotPasswordRepository {
    abstract requestResetLink(
        request: ForgotPasswordRequest,
    ): Observable<ForgotPasswordResult>;
}