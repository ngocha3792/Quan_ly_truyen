import { Inject, Injectable } from '@nestjs/common';

import { ManagedUserNotFoundException } from '../../../domain';

import type { ManagedUserDetailResultDto } from '../../dto';

import { ManagedUserResultMapper } from '../../mappers';

import {
  MANAGED_USER_READER_PORT,
  type ManagedUserReaderPort,
} from '../../ports';

import { GetManagedUserQuery } from './get-managed-user.query';

@Injectable()
export class GetManagedUserQueryHandler {
  constructor(
    @Inject(MANAGED_USER_READER_PORT)
    private readonly reader: ManagedUserReaderPort,
  ) {}

  async execute(
    query: GetManagedUserQuery,
  ): Promise<ManagedUserDetailResultDto> {
    const user = await this.reader.findManagedUserById(
      query.userId,

      new Date(),
    );

    if (!user) {
      throw new ManagedUserNotFoundException(query.userId);
    }

    return ManagedUserResultMapper.toDetailDto(user);
  }
}
