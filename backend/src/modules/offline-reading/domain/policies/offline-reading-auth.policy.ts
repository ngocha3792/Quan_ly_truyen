import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

export function requireOfflineUserId(userId: string | undefined): string {
  return requireUuid(userId, 'user');
}

export function requireOfflineSessionId(sessionId: string | undefined): string {
  return requireUuid(sessionId, 'session');
}

function requireUuid(value: string | undefined, subject: string): string {
  if (!value || !isUuidV4(value)) {
    throw new AuthenticationRequiredException({
      code: 'OFFLINE_READING_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để sử dụng tính năng đọc offline',
      details: { subject },
    });
  }
  return value;
}
