import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  Public,
  RequirePermissions,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import {
  PAYMENT_ROLLOUT_PORT,
  type PaymentRolloutPort,
} from '../../../application/ports/payment-rollout.port';
import {
  MONETIZATION_RATE_LIMITER_PORT,
  type MonetizationRateLimiterPort,
} from '@/modules/monetization';

import {
  CreatePaymentOrderCommand,
  CreatePaymentOrderCommandHandler,
  GetOwnPaymentOrderQuery,
  GetOwnPaymentOrderQueryHandler,
  ListCreditPackagesQuery,
  ListCreditPackagesQueryHandler,
  ListOwnPaymentOrdersQuery,
  ListOwnPaymentOrdersQueryHandler,
  ManagePaymentProvidersCommandHandler,
  MarkPaymentOrderTransferredCommand,
  MarkPaymentOrderTransferredCommandHandler,
} from '../../../application';
import { PaymentProviderFeatureGuard } from '../guards';
import {
  CreatePaymentOrderRequest,
  ListPaymentOrdersRequest,
  TransferClaimRequest,
} from '../requests';

@Controller('billing')
@UseGuards(PaymentProviderFeatureGuard)
export class BillingController {
  constructor(
    private readonly listPackages: ListCreditPackagesQueryHandler,
    private readonly createOrder: CreatePaymentOrderCommandHandler,
    private readonly getOrder: GetOwnPaymentOrderQueryHandler,
    private readonly listOrders: ListOwnPaymentOrdersQueryHandler,
    private readonly paymentProviders: ManagePaymentProvidersCommandHandler,
    private readonly markTransferred: MarkPaymentOrderTransferredCommandHandler,
    @Inject(MONETIZATION_RATE_LIMITER_PORT)
    private readonly rateLimiter: MonetizationRateLimiterPort,
    @Inject(PAYMENT_ROLLOUT_PORT) private readonly rollout: PaymentRolloutPort,
  ) {}

  @Get('credit-packages')
  @Public()
  packages() {
    return this.listPackages.execute(new ListCreditPackagesQuery(true));
  }

  @Get('payment-methods')
  @Public()
  async paymentMethods(
    @Query('storyId', new ParseUUIDPipe({ version: '4', optional: true }))
    storyId?: string,
  ) {
    const connections = await this.paymentProviders.list(true);
    const allowed = await this.rollout.allowed(storyId);
    return connections
      .filter((c) => c.kind !== 'VNPAY' || (allowed && c.configurationReady))
      .map(
        ({
          id,
          code,
          kind,
          displayName,
          description,
          currency,
          sortOrder,
        }) => ({
          id,
          code,
          kind,
          displayName,
          description,
          currency,
          sortOrder,
        }),
      );
  }

  @Post('top-up-orders')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_CREATE_SELF)
  async create(
    @CurrentUserId() userId: string | undefined,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreatePaymentOrderRequest,
    @ClientIp() ipAddress?: string,
  ) {
    await this.rateLimiter.consume({
      operation: 'order_create',
      subject: `user:${userId ?? 'missing'}`,
    });
    return this.createOrder.execute(
      new CreatePaymentOrderCommand(
        userId,
        request.packageId,
        idempotencyKey,
        request.providerConnectionId,
        request.storyId,
        ipAddress,
      ),
    );
  }

  @Get('top-up-orders/me')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_READ_SELF)
  async history(
    @CurrentUserId() userId: string | undefined,
    @Query() request: ListPaymentOrdersRequest,
  ) {
    await this.rateLimiter.consume({
      operation: 'order_poll',
      subject: `user:${userId ?? 'missing'}`,
    });
    return this.listOrders.execute(
      new ListOwnPaymentOrdersQuery(userId, request.page, request.pageSize),
    );
  }

  @Get('top-up-orders/:orderId')
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_READ_SELF)
  async get(
    @CurrentUserId() userId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    await this.rateLimiter.consume({
      operation: 'order_poll',
      subject: `user:${userId ?? 'missing'}`,
    });
    return this.getOrder.execute(new GetOwnPaymentOrderQuery(userId, orderId));
  }

  @Post('top-up-orders/:orderId/transfer-claim')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_CREATE_SELF)
  async transferClaim(
    @CurrentUserId() userId: string | undefined,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() request: TransferClaimRequest,
  ) {
    await this.rateLimiter.consume({
      operation: 'order_transfer_claim',
      subject: `user:${userId ?? 'missing'}`,
    });
    return this.markTransferred.execute(
      new MarkPaymentOrderTransferredCommand(
        userId,
        orderId,
        request.referenceCode,
        request.note,
      ),
    );
  }
}
