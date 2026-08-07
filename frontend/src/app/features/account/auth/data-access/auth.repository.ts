import { Observable } from 'rxjs';
import {
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailResponse,
} from '../domain/auth.models';

export abstract class AuthFeatureRepository {
  abstract login(payload: LoginRequest): Observable<LoginResponse>;
  abstract register(payload: RegisterRequest): Observable<RegisterResponse>;
  abstract verifyEmail(token: string): Observable<VerifyEmailResponse>;
  abstract logout(): Observable<void>;
  abstract getCurrentUser(): Observable<CurrentUser>;
}
