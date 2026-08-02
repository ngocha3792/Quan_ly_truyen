import { ConfigurationException } from '@/common/exceptions';

export class DefaultRoleNotFoundException extends ConfigurationException {
  constructor(roleCode: string) {
    super({
      code: 'AUTH_DEFAULT_ROLE_NOT_FOUND',
      message: 'Không tìm thấy role mặc định cho tài khoản mới',
      details: {
        roleCode,
      },
    });
  }
}
