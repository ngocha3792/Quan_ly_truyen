import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import {
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailResponse,
} from '../domain/auth.models';
import {
  MOCK_CURRENT_USER,
  MOCK_LOGIN_RESPONSE,
  MOCK_REGISTER_RESPONSE,
  MOCK_VERIFY_EMAIL_RESPONSE,
} from '../mock/auth.mock';
import { AuthFeatureRepository } from './auth.repository';

@Injectable()
export class AuthFeatureMockRepository implements AuthFeatureRepository {
  login(_payload: LoginRequest): Observable<LoginResponse> {
    return of(MOCK_LOGIN_RESPONSE).pipe(delay(400));
  }

  register(_payload: RegisterRequest): Observable<RegisterResponse> {
    return of(MOCK_REGISTER_RESPONSE).pipe(delay(500));
  }

  verifyEmail(_token: string): Observable<VerifyEmailResponse> {
    return of(MOCK_VERIFY_EMAIL_RESPONSE).pipe(delay(300));
  }

  logout(): Observable<void> {
    return of(undefined).pipe(delay(200));
  }

  getCurrentUser(): Observable<CurrentUser> {
    return of(MOCK_CURRENT_USER).pipe(delay(300));
  }
}
