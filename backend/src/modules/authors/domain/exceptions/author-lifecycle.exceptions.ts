import {
  AccessDeniedException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class AuthorLifecycleNotActiveException extends AccessDeniedException {
  constructor(status: string) {
    super({
      code: 'AUTHOR_LIFECYCLE_NOT_ACTIVE',
      message: 'Tài khoản tác giả hiện không được phép thực hiện thao tác ghi',
      details: { status },
    });
  }
}

export class ManagedAuthorNotFoundException extends ResourceNotFoundException {
  constructor(authorId: string) {
    super({
      code: 'MANAGED_AUTHOR_NOT_FOUND',
      resource: 'tác giả',
      identifier: authorId,
      message: 'Không tìm thấy tác giả cần quản lý',
    });
  }
}

export class AuthorStatusReasonRequiredException extends InvalidInputException {
  constructor() {
    super({
      code: 'AUTHOR_STATUS_REASON_REQUIRED',
      message:
        'Lý do phải có từ 10 đến 1000 ký tự khi suspend hoặc revoke tác giả',
      details: { field: 'reason' },
    });
  }
}
