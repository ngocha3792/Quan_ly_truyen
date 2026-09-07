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

import { CurrentUserId, Public, RequirePermissions } from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
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
} from '../../../application';
import { PaymentProviderFeatureGuard } from '../guards';
import {
  CreatePaymentOrderRequest,
  ListPaymentOrdersRequest,
} from '../requests';

@Controller('billing')
@UseGuards(PaymentProviderFeatureGuard)
export class BillingController {
  constructor(
    private readonly listPackages: ListCreditPackagesQueryHandler,
    private readonly createOrder: CreatePaymentOrderCommandHandler,
    private readonly getOrder: GetOwnPaymentOrderQueryHandler,
    private readonly listOrders: ListOwnPaymentOrdersQueryHandler,
    @Inject(MONETIZATION_RATE_LIMITER_PORT)
    private readonly rateLimiter: MonetizationRateLimiterPort,
  ) {}

  @Get('credit-packages')
  @Public()
  packages() {
    return this.listPackages.execute(new ListCreditPackagesQuery(true));
  }

  @Post('top-up-orders')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.PAYMENT_ORDER_CREATE_SELF)
  async create(
    @CurrentUserId() userId: string | undefined,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreatePaymentOrderRequest,
  ) {
    await this.rateLimiter.consume({
      operation: 'order_create',
      subject: `user:${userId ?? 'missing'}`,
    });
    return this.createOrder.execute(
      new CreatePaymentOrderCommand(userId, request.packageId, idempotencyKey),
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
}
