import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

export function requireLibraryUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'READER_ENGAGEMENT_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để sử dụng tính năng này',
    });
  }

  return userId;
}
