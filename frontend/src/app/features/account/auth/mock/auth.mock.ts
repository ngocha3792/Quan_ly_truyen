import {
  AuthUserSummary,
  CurrentUser,
  LoginResponse,
  RegisterResponse,
  VerifyEmailResponse,
} from '../domain/auth.models';

export const MOCK_AUTH_USER: AuthUserSummary = {
  id: 'user-mock-1',
  email: 'demouser@truyenhub.vn',
  username: 'demouser',
  displayName: 'Độc Giả Demo',
  emailVerified: true,
  roles: ['user'],
};

export const MOCK_CURRENT_USER: CurrentUser = {
  ...MOCK_AUTH_USER,
  sessionId: 'session-mock-123',
  bio: 'Yêu thích đọc truyện tiên hiệp và huyền huyễn.',
  status: 'active',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
  avatar: {
    id: 'avatar-1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  authorProfile: null,
  permissions: ['read:story', 'comment:create'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
};

export const MOCK_LOGIN_RESPONSE: LoginResponse = {
  sessionId: 'session-mock-123',
  accessToken: 'mock-access-token-xyz',
  tokenType: 'Bearer',
  expiresIn: 86400,
  expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  user: MOCK_AUTH_USER,
};

export const MOCK_REGISTER_RESPONSE: RegisterResponse = {
  id: 'user-mock-2',
  email: 'newuser@truyenhub.vn',
  username: 'newuser',
  displayName: 'Người Dùng Mới',
  verificationRequired: true,
};

export const MOCK_VERIFY_EMAIL_RESPONSE: VerifyEmailResponse = {
  emailVerified: true,
  alreadyVerified: false,
  verifiedAt: new Date().toISOString(),
};
