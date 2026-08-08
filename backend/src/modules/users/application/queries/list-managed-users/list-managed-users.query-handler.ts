import { Inject, Injectable } from '@nestjs/common';

import type { ManagedUserListResultDto } from '../../dto';

import { ManagedUserResultMapper } from '../../mappers';

import {
  MANAGED_USER_READER_PORT,
  type ManagedUserReaderPort,
} from '../../ports';

import { ListManagedUsersQuery } from './list-managed-users.query';

@Injectable()
export class ListManagedUsersQueryHandler {
  constructor(
    @Inject(MANAGED_USER_READER_PORT)
    private readonly reader: ManagedUserReaderPort,
  ) {}

  async execute(
    query: ListManagedUsersQuery,
  ): Promise<ManagedUserListResultDto> {
    const keyword = query.keyword?.trim() || undefined;

    const offset = Math.max(
      0,

      Math.trunc(query.offset),
    );

    const limit = Math.min(
      100,

      Math.max(
        1,

        Math.trunc(query.limit),
      ),
    );

    const result = await this.reader.listManagedUsers({
      keyword,

      status: query.status,

      role: query.role,

      offset,

      limit,

      now: new Date(),
    });

    return {
      total: result.total,

      users: result.users.map((user) =>
        ManagedUserResultMapper.toSummaryDto(user),
      ),
    };
  }
}
