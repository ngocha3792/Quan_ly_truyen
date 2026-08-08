import type { RoleCode } from '@/common/enums';

import type {
  ManagedUserDetailEntity,
  ManagedUserStatus,
  ManagedUserSummaryEntity,
} from '../../domain';

export const MANAGED_USER_READER_PORT = Symbol('MANAGED_USER_READER_PORT');

export interface ListManagedUsersReadInput {
  readonly keyword?: string;

  readonly status?: ManagedUserStatus;

  readonly role?: RoleCode;

  readonly offset: number;

  readonly limit: number;

  readonly now: Date;
}

export interface ListManagedUsersReadResult {
  readonly total: number;

  readonly users: readonly ManagedUserSummaryEntity[];
}

export interface ManagedUserReaderPort {
  listManagedUsers(
    input: ListManagedUsersReadInput,
  ): Promise<ListManagedUsersReadResult>;

  findManagedUserById(
    userId: string,

    now: Date,
  ): Promise<ManagedUserDetailEntity | null>;
}
