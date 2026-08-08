import type { RoleCode } from '@/common/enums';

import {
  BusinessRuleViolationException,
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class ManagedUserNotFoundException extends ResourceNotFoundException {
  constructor(userId?: string) {
    super({
      code: 'MANAGED_USER_NOT_FOUND',

      resource: 'người dùng',

      ...(userId
        ? {
            identifier: userId,
          }
        : {}),

      message: 'Không tìm thấy người dùng cần quản lý',
    });
  }
}

export class ManagedUserSelfStatusChangeException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'MANAGED_USER_SELF_STATUS_CHANGE_FORBIDDEN',

      rule: 'admin-cannot-change-own-status',

      message: 'Bạn không thể thay đổi trạng thái tài khoản của chính mình',
    });
  }
}

export class ManagedUserDeletedException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'MANAGED_USER_DELETED',

      rule: 'deleted-user-is-immutable',

      message: 'Không thể thay đổi tài khoản đã bị xóa',
    });
  }
}

export class ManagedUserStatusNotManageableException extends InvalidInputException {
  constructor() {
    super({
      code: 'MANAGED_USER_STATUS_NOT_MANAGEABLE',

      message:
        'Trạng thái tài khoản không được phép thay đổi từ User Management',

      details: {
        field: 'status',
      },
    });
  }
}

export class ManagedUserRoleProtectedException extends BusinessRuleViolationException {
  constructor(roleCode: RoleCode) {
    super({
      code: 'MANAGED_USER_ROLE_PROTECTED',

      rule: 'protected-system-role',

      message:
        roleCode === 'AUTHOR'
          ? 'Role AUTHOR phải được quản lý thông qua quy trình đăng ký tác giả'
          : 'Role này không được quản lý trực tiếp từ User Management',

      details: {
        roleCode,
      },
    });
  }
}

export class ManagedUserRoleUnavailableException extends BusinessRuleViolationException {
  constructor(roleCode: RoleCode) {
    super({
      code: 'MANAGED_USER_ROLE_UNAVAILABLE',

      rule: 'managed-role-must-exist',

      message: 'Role cần quản lý chưa được cấu hình trong hệ thống',

      details: {
        roleCode,
      },
    });
  }
}

export class ManagedUserSelfAdminRoleRemovalException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'MANAGED_USER_SELF_ADMIN_ROLE_REMOVAL_FORBIDDEN',

      rule: 'admin-cannot-remove-own-admin-role',

      message: 'Bạn không thể tự gỡ quyền ADMIN của chính mình',
    });
  }
}

export class LastActiveAdminException extends BusinessRuleViolationException {
  constructor() {
    super({
      code: 'LAST_ACTIVE_ADMIN_REQUIRED',

      rule: 'last-active-admin-must-remain',

      message: 'Hệ thống phải còn ít nhất một quản trị viên đang hoạt động',
    });
  }
}
