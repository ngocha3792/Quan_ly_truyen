import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthApiService } from '../../../../core/auth/auth-api.service';
import {
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailResponse,
} from '../domain/auth.models';
import { AuthFeatureRepository } from './auth.repository';

@Injectable()
export class AuthFeatureHttpRepository implements AuthFeatureRepository {
  private readonly apiService = inject(AuthApiService);

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.apiService.login(payload);
  }

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    return this.apiService.register(payload);
  }

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.apiService.verifyEmail(token);
  }

  logout(): Observable<void> {
    return this.apiService.logout();
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.apiService.me();
  }
}
