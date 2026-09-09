import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  PAYMENT_ROLLOUT_PORT,
  type PaymentRolloutPort,
} from '../../../application/ports/payment-rollout.port';

class UpdatePaymentRolloutRequest {
  @IsBoolean() isEnabled!: boolean;
  @IsArray()
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsIn(['VNPAY'], { each: true })
  enabledProviders!: string[];
}
@Controller('admin/billing/story-allowlists')
@RequirePermissions(PermissionCode.PAYMENT_PROVIDER_MANAGE_ADMIN)
export class AdminPaymentRolloutController {
  constructor(
    @Inject(PAYMENT_ROLLOUT_PORT) private readonly rollout: PaymentRolloutPort,
  ) {}
  @Get(':storyId') get(
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ) {
    return this.rollout.get(storyId);
  }
  @Put(':storyId') update(
    @CurrentUserId() actorId: string,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpdatePaymentRolloutRequest,
  ) {
    return this.rollout.update(actorId, storyId, request);
  }
}
