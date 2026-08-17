import { Injectable } from '@nestjs/common';
import { ManagedUserStatus } from '../../domain';
import type { UserModerationPort } from '../../public';
import {
  UpdateManagedUserStatusCommand,
  UpdateManagedUserStatusCommandHandler,
} from '../commands';

@Injectable()
export class UserModerationFacade implements UserModerationPort {
  constructor(
    private readonly updateUserStatus: UpdateManagedUserStatusCommandHandler,
  ) {}

  async banUser(input: {
    readonly actorUserId: string;
    readonly targetUserId: string;
    readonly reason: string;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  }): Promise<void> {
    await this.updateUserStatus.execute(
      new UpdateManagedUserStatusCommand(
        input.actorUserId,
        input.targetUserId,
        ManagedUserStatus.BANNED,
        input.ipAddress,
        input.userAgent,
        input.requestId,
        input.reason,
      ),
    );
  }
}
