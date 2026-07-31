import { AuthPrincipal } from './auth-principal.interface';

export interface AuthContext {
  /**
   * null nghĩa là Guest.
   */
  principal: AuthPrincipal | null;

  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}
