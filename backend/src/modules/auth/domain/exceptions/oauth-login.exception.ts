import {
  ConfigurationException,
  ExternalServiceException,
  InvalidInputException,
  ResourceConflictException,
} from '@/common/exceptions';

export class OAuthProviderUnavailableException extends ConfigurationException {
  constructor(provider: string) {
    super({
      code: 'AUTH_OAUTH_PROVIDER_UNAVAILABLE',
      message: 'Nhà cung cấp OAuth chưa được cấu hình',
      details: { provider },
    });
  }
}

export class OAuthFlowInvalidException extends InvalidInputException {
  constructor(message = 'Luồng OAuth không hợp lệ hoặc đã hết hạn') {
    super({
      code: 'AUTH_OAUTH_FLOW_INVALID',
      message,
    });
  }
}

export class OAuthProviderRequestException extends ExternalServiceException {
  constructor(provider: string, cause?: unknown) {
    super({
      code: 'AUTH_OAUTH_PROVIDER_REQUEST_FAILED',
      message: 'Không thể xác minh tài khoản với nhà cung cấp OAuth',
      service: provider,
      cause,
    });
  }
}

export class OAuthEmailUnavailableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'AUTH_OAUTH_VERIFIED_EMAIL_REQUIRED',
      message: 'Nhà cung cấp OAuth không trả về email đã xác minh',
      resource: 'OAuth account',
    });
  }
}

export class OAuthAccountLinkingRequiredException extends ResourceConflictException {
  constructor() {
    super({
      code: 'AUTH_OAUTH_ACCOUNT_LINKING_REQUIRED',
      message:
        'Email đã tồn tại nhưng chưa đủ điều kiện liên kết tự động. Hãy đăng nhập bằng phương thức hiện có và xác minh email trước',
      resource: 'Tài khoản',
    });
  }
}
