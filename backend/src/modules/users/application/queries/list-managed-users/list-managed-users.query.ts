import type { RoleCode } from '@/common/enums';

import type { ManagedUserStatus } from '../../../domain';

export class ListManagedUsersQuery {
  constructor(
    readonly keyword: string | undefined,

    readonly status: ManagedUserStatus | undefined,

    readonly role: RoleCode | undefined,

    readonly offset: number,

    readonly limit: number,
  ) {}
}
