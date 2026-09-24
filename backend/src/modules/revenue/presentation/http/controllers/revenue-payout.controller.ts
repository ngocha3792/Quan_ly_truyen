import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { RevenuePayoutCommandHandler } from '../../../application/commands/revenue-payout.command-handler';
import { RevenuePayoutQueryHandler } from '../../../application/queries/revenue-payout.query-handler';
import {
  CompletePayoutRequest,
  CreatePayoutAccountRequest,
  CreatePayoutBatchRequest,
  CreatePayoutRequest,
  FailPayoutRequest,
  RevenuePolicyRequest,
  ReviewPayoutAccountRequest,
  UpdatePayoutAccountRequest,
} from '../requests/revenue-payout.request';

function principal(userId?: string) {
  if (!userId) throw new UnauthorizedException();
  return userId;
}

@Controller('author/revenue')
@RequirePermissions(PermissionCode.WALLET_READ_SELF)
export class AuthorRevenuePayoutController {
  constructor(
    private readonly commands: RevenuePayoutCommandHandler,
    private readonly queries: RevenuePayoutQueryHandler,
  ) {}
  @Get('earnings') earnings(@CurrentUserId() userId?: string) {
    return this.queries.earnings(principal(userId));
  }
  @Get('payout-accounts') accounts(@CurrentUserId() userId?: string) {
    return this.queries.accounts(principal(userId));
  }
  @Post('payout-accounts') createAccount(
    @CurrentUserId() userId: string | undefined,
    @Body() request: CreatePayoutAccountRequest,
  ) {
    return this.commands.createAccount(userId, request);
  }
  @Patch('payout-accounts/:id') updateAccount(
    @CurrentUserId() userId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: UpdatePayoutAccountRequest,
  ) {
    return this.commands.updateAccount(userId, id, request);
  }
  @Get('payout-requests') requests(@CurrentUserId() userId?: string) {
    return this.queries.requests(principal(userId));
  }
  @Post('payout-requests') createRequest(
    @CurrentUserId() userId: string | undefined,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreatePayoutRequest,
  ) {
    return this.commands.createRequest(
      userId,
      request.accountId,
      request.grossAmount,
      idempotencyKey ?? '',
    );
  }
  @Post('payout-requests/:id/cancel') cancelRequest(
    @CurrentUserId() userId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.commands.cancelRequest(userId, id);
  }
}

@Controller('admin/revenue')
export class AdminRevenuePayoutController {
  constructor(
    private readonly commands: RevenuePayoutCommandHandler,
    private readonly queries: RevenuePayoutQueryHandler,
  ) {}
  @Get('policy')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  policy() {
    return this.queries.policy();
  }
  @Put('policy')
  @RequirePermissions(PermissionCode.PAYMENT_PROVIDER_MANAGE_ADMIN)
  updatePolicy(
    @CurrentUserId() actorId: string | undefined,
    @Body() request: RevenuePolicyRequest,
  ) {
    return this.commands.updatePolicy(actorId, request);
  }
  @Get('payout-accounts')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  accounts() {
    return this.queries.accounts();
  }
  @Post('payout-accounts/:id/review')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  reviewAccount(
    @CurrentUserId() actorId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: ReviewPayoutAccountRequest,
  ) {
    return this.commands.reviewAccount(actorId, id, request);
  }
  @Get('payout-requests')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  requests() {
    return this.queries.requests();
  }
  @Get('payout-batches')
  @RequirePermissions(PermissionCode.PAYMENT_READ_ADMIN)
  batches() {
    return this.queries.batches();
  }
  @Post('payout-batches')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  createBatch(
    @CurrentUserId() actorId: string | undefined,
    @Body() request: CreatePayoutBatchRequest,
  ) {
    return this.commands.createBatch(actorId, request.requestIds);
  }
  @Get('payout-batches/:id/export')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  exportBatch(
    @CurrentUserId() actorId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.commands.exportBatch(actorId, id);
  }
  @Post('payout-requests/:id/complete')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  complete(
    @CurrentUserId() actorId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: CompletePayoutRequest,
  ) {
    return this.commands.completeRequest(actorId, id, request);
  }
  @Post('payout-requests/:id/fail')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_SETTLE_ADMIN)
  fail(
    @CurrentUserId() actorId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: FailPayoutRequest,
  ) {
    return this.commands.failRequest(actorId, id, request);
  }
  @Get('reconciliation')
  @RequirePermissions(PermissionCode.PAYMENT_RECONCILE_ADMIN)
  reconcile() {
    return this.queries.reconcile();
  }
}
