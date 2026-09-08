import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import { ManagePaymentProvidersCommandHandler } from '../../../application';
import {
  CreatePaymentProviderRequest,
  UpdatePaymentProviderRequest,
} from '../requests';

@Controller('admin/billing/payment-providers')
@RequirePermissions(PermissionCode.PAYMENT_PROVIDER_MANAGE_ADMIN)
export class AdminPaymentProvidersController {
  constructor(
    private readonly providers: ManagePaymentProvidersCommandHandler,
  ) {}

  @Get()
  list() {
    return this.providers.list(false);
  }

  @Get('kinds')
  kinds() {
    return this.providers.listKinds();
  }

  @Post()
  create(
    @CurrentUserId() actorId: string | undefined,
    @Body() request: CreatePaymentProviderRequest,
  ) {
    return this.providers.create(actorId, request);
  }

  @Patch(':id')
  update(
    @CurrentUserId() actorId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: UpdatePaymentProviderRequest,
  ) {
    return this.providers.update(actorId, id, request);
  }

  @Delete(':id')
  async delete(
    @CurrentUserId() actorId: string | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.providers.delete(actorId, id);
    return { deleted: true };
  }
}
