import type { RoleCode } from '@/common/enums';

export interface LoginResponse {
  sessionId: string;

  accessToken: string;
  tokenType: 'Bearer';

  expiresIn: number;
  expiresAt: string;

  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    emailVerified: boolean;
    roles: readonly RoleCode[];
  };
}
