export type {
  AuthUserSummary,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
} from '../../../core/auth/auth.models';

export type AuthMode = 'login' | 'register' | 'forgot-password';

export interface AuthDialogConfig {
  readonly mode: AuthMode;
  readonly returnUrl?: string;
}

export interface AuthFormState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly successMessage: string | null;
}
