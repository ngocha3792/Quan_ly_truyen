import { Inject, Injectable } from '@nestjs/common';

import { InvalidTokenException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import { JWT_BLACKLIST_PORT, type JwtBlacklistPort } from '../../ports';
import { JwtBlacklistReason } from '../../../domain/enums';

import { RevokeAccessTokenCommand } from './revoke-access-token.command';

@Injectable()
export class RevokeAccessTokenCommandHandler {
  constructor(
    @Inject(JWT_BLACKLIST_PORT)
    private readonly jwtBlacklist: JwtBlacklistPort,
  ) {}

  async execute(command: RevokeAccessTokenCommand): Promise<void> {
    if (
      !isUuidV4(command.tokenId) ||
      !(command.expiresAt instanceof Date) ||
      Number.isNaN(command.expiresAt.getTime())
    ) {
      throw new InvalidTokenException({
        code: 'AUTH_ACCESS_TOKEN_METADATA_INVALID',

        message: 'Không thể thu hồi access token hiện tại',
      });
    }

    await this.jwtBlacklist.blacklist({
      tokenId: command.tokenId,
      expiresAt: command.expiresAt,

      reason: JwtBlacklistReason.USER_REVOKED_CURRENT_ACCESS_TOKEN,
    });
  }
}
