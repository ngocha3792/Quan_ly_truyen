import {
  BusinessRuleViolationException,
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidAuthorApplicationFieldException extends InvalidInputException {
  constructor(
    field: string,

    message: string,
  ) {
    super({
      code: 'AUTHOR_APPLICATION_INVALID_FIELD',

      message,

      details: {
        field,
      },
    });
  }
}

export class AuthorApplicationNotFoundException extends ResourceNotFoundException {
  constructor(applicationId?: string) {
    super({
      code: 'AUTHOR_APPLICATION_NOT_FOUND',

      resource: 'hồ sơ đăng ký tác giả',

      ...(applicationId
        ? {
            identifier: applicationId,
          }
        : {}),

      message: 'Không tìm thấy hồ sơ đăng ký tác giả',
    });
  }
}

export class AuthorApplicationPendingException extends ResourceConflictException {
  constructor() {
    super({
      code: 'AUTHOR_APPLICATION_ALREADY_PENDING',

      resource: 'hồ sơ đăng ký tác giả',

      message: 'Hồ sơ đang chờ xét duyệt và không thể chỉnh sửa',
    });
  }
}

export class AuthorAlreadyActiveException extends ResourceConflictException {
  constructor() {
    super({
      code: 'AUTHOR_ALREADY_ACTIVE',

      resource: 'tác giả',

      message: 'Tài khoản đã được kích hoạt quyền tác giả',
    });
  }
}

export class AuthorApplicationIncompleteException extends BusinessRuleViolationException {
  constructor(fields: readonly string[]) {
    super({
      code: 'AUTHOR_APPLICATION_INCOMPLETE',

      rule: 'author-application-completeness',

      message: 'Hồ sơ đăng ký tác giả chưa đầy đủ',

      details: {
        fields: [...fields],
      },
    });
  }
}

export class InvalidAuthorApplicationSampleException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'AUTHOR_APPLICATION_SAMPLE_INVALID',

      rule: 'author-application-sample',

      message: 'File mẫu không hợp lệ hoặc chưa được upload hoàn tất',
    });
  }
}

export class AuthorPenNameUnavailableException extends ResourceConflictException {
  constructor(penName: string) {
    super({
      code: 'AUTHOR_PEN_NAME_UNAVAILABLE',

      resource: 'tên bút danh',

      field: 'penName',

      value: penName,

      message: 'Bút danh này đã được sử dụng',
    });
  }
}

export class AuthorApplicationNotPendingException extends ResourceConflictException {
  constructor() {
    super({
      code: 'AUTHOR_APPLICATION_NOT_PENDING',

      resource: 'hồ sơ đăng ký tác giả',

      message: 'Chỉ hồ sơ đang chờ xét duyệt mới có thể được xử lý',
    });
  }
}

export class AuthorRoleUnavailableException extends ResourceConflictException {
  constructor() {
    super({
      code: 'AUTHOR_ROLE_NOT_CONFIGURED',

      resource: 'role AUTHOR',

      message: 'Hệ thống chưa cấu hình role AUTHOR',
    });
  }
}

export class AuthorApplicationSelfReviewException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'AUTHOR_APPLICATION_SELF_REVIEW_NOT_ALLOWED',

      rule: 'author-application-reviewer',

      message: 'Không thể tự xét duyệt hồ sơ của chính mình',
    });
  }
}
