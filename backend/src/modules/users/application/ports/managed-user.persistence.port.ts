import type { RoleCode } from '@/common/enums';

import type { ManagedUserDetailEntity, ManagedUserStatus } from '../../domain';

export const MANAGED_USER_PERSISTENCE_PORT = Symbol(
  'MANAGED_USER_PERSISTENCE_PORT',
);

export interface ManagedUserAuditContext {
  readonly ipAddress?: string;

  readonly userAgent?: string;

  readonly requestId?: string;
}

export interface UpdateManagedUserStatusPersistenceInput {
  readonly actorUserId: string;

  readonly targetUserId: string;

  readonly status: ManagedUserStatus;

  readonly reason?: string;

  readonly changedAt: Date;

  readonly audit: ManagedUserAuditContext;
}

export type UpdateManagedUserStatusPersistenceResult =
  | {
      readonly status: 'updated';

      readonly user: ManagedUserDetailEntity;
    }
  | {
      readonly status: 'unchanged';

      readonly user: ManagedUserDetailEntity;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'deleted';
    }
  | {
      readonly status: 'last_active_admin';
    };

export interface ChangeManagedUserRolePersistenceInput {
  readonly actorUserId: string;

  readonly targetUserId: string;

  readonly roleCode: RoleCode;

  readonly changedAt: Date;

  readonly audit: ManagedUserAuditContext;
}

export type ChangeManagedUserRolePersistenceResult =
  | {
      readonly status: 'updated';

      readonly user: ManagedUserDetailEntity;
    }
  | {
      readonly status: 'unchanged';

      readonly user: ManagedUserDetailEntity;
    }
  | {
      readonly status: 'not_found';
    }
  | {
      readonly status: 'deleted';
    }
  | {
      readonly status: 'role_missing';
    }
  | {
      readonly status: 'role_protected';
    }
  | {
      readonly status: 'last_active_admin';
    };

export interface ManagedUserPersistencePort {
  updateManagedUserStatus(
    input: UpdateManagedUserStatusPersistenceInput,
  ): Promise<UpdateManagedUserStatusPersistenceResult>;

  assignManagedUserRole(
    input: ChangeManagedUserRolePersistenceInput,
  ): Promise<ChangeManagedUserRolePersistenceResult>;

  removeManagedUserRole(
    input: ChangeManagedUserRolePersistenceInput,
  ): Promise<ChangeManagedUserRolePersistenceResult>;
}
