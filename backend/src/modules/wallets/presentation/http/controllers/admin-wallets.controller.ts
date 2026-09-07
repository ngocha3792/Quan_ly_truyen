import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';

import {
  AdminAdjustWalletCommand,
  AdminAdjustWalletCommandHandler,
} from '../../../application';
import { MonetizationEnabledGuard } from '../guards';
import { AdminAdjustWalletRequest } from '../requests';

@Controller('admin/wallets')
@UseGuards(MonetizationEnabledGuard)
export class AdminWalletsController {
  constructor(private readonly adjustWallet: AdminAdjustWalletCommandHandler) {}

  @Post(':userId/adjustments')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.WALLET_ADJUST_ADMIN)
  adjust(
    @CurrentUserId() actorId: string | undefined,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: AdminAdjustWalletRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.adjustWallet.execute(
      new AdminAdjustWalletCommand(
        actorId,
        userId,
        request.direction,
        request.amount,
        request.reason,
        idempotencyKey,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
