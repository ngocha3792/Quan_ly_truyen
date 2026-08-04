import type { LoginClientContext } from '../commands/login/login.command';

export const ADMIN_MFA_CHALLENGE_PORT = Symbol('AUTH_ADMIN_MFA_CHALLENGE_PORT');

export type AdminMfaChallengeMode = 'enroll' | 'verify';
export type AdminMfaChallengeSource = 'password' | 'google' | 'github';

export interface CreateAdminMfaChallengeInput {
  userId: string;
  mode: AdminMfaChallengeMode;
  source: AdminMfaChallengeSource;
  client: LoginClientContext;
}

export interface AdminMfaChallengeResult {
  ticket: string;
  mode: AdminMfaChallengeMode;
  expiresAt: Date;
}

export interface AdminMfaChallengePort {
  isEnabled(): boolean;
  create(input: CreateAdminMfaChallengeInput): Promise<AdminMfaChallengeResult>;
}
