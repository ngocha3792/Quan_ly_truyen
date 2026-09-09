import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  ClientIp,
  Public,
  SkipRequestLogging,
  SkipResponseEnvelope,
} from '@/common/decorators';
import {
  MONETIZATION_RATE_LIMITER_PORT,
  type MonetizationRateLimiterPort,
} from '@/modules/monetization';
import {
  PAYMENT_IPN_PORT,
  type PaymentIpnPort,
} from '../../../application/ports/payment-ipn.port';

@Controller('webhooks/payments')
@Public()
@SkipResponseEnvelope()
@SkipRequestLogging()
export class VnpayIpnController {
  constructor(
    @Inject(PAYMENT_IPN_PORT) private readonly ipn: PaymentIpnPort,
    @Inject(MONETIZATION_RATE_LIMITER_PORT)
    private readonly limiter: MonetizationRateLimiterPort,
  ) {}
  @Get(':providerCode/ipn')
  async handle(
    @Param('providerCode') code: string,
    @Query() query: Record<string, unknown>,
    @ClientIp() ip?: string,
  ) {
    if (
      !/^[a-z0-9][a-z0-9-]{1,49}$/u.test(code) ||
      Object.values(query).some((v) => typeof v !== 'string') ||
      JSON.stringify(query).length > 32768
    )
      return { RspCode: '97', Message: 'Invalid callback' };
    try {
      await this.limiter.consume({
        operation: 'payment_webhook',
        subject: `ip:${ip ?? 'unknown'}`,
      });
      return await this.ipn.handle(code, query as Record<string, string>);
    } catch {
      return { RspCode: '99', Message: 'Retry callback' };
    }
  }
}
