import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { ManageRevenueAgreementsCommandHandler } from '../../../application/commands/manage-revenue-agreements.command-handler';
import {
  CreateRevenueAgreementRequest,
  ListRevenueAgreementRequest,
  SettleRevenueRequest,
} from '../requests/revenue-agreement.request';

@Controller('admin/revenue')
export class AdminRevenueAgreementController {
  constructor(
    private readonly agreements: ManageRevenueAgreementsCommandHandler,
  ) {}
  @Get('agreements')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  list(@Query() input: ListRevenueAgreementRequest) {
    return this.agreements.list(input.storyId);
  }
  @Post('agreements')
  @RequirePermissions(PermissionCode.PAYMENT_PROVIDER_MANAGE_ADMIN)
  create(
    @CurrentUserId() actorId: string | undefined,
    @Headers('x-idempotency-key') key: string | undefined,
    @Body() input: CreateRevenueAgreementRequest,
  ) {
    if (!actorId) throw new UnauthorizedException();
    return this.agreements.create({
      ...input,
      actorId,
      idempotencyKey: key ?? '',
    });
  }
  @Post('settle')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  settle(@Body() input: SettleRevenueRequest) {
    return this.agreements.settle(input.limit);
  }
}

@Controller('author/revenue/agreements')
@RequirePermissions(PermissionCode.WALLET_READ_SELF)
export class AuthorRevenueAgreementController {
  constructor(
    private readonly agreements: ManageRevenueAgreementsCommandHandler,
  ) {}
  @Get(':storyId')
  list(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.agreements.list(storyId, userId);
  }
}
