import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  ListPriceBandsQuery,
  ListPriceBandsQueryHandler,
  UpdatePriceBandCommand,
  UpdatePriceBandCommandHandler,
} from '../../../application';
import { AuthorPricingFeatureGuard } from '../guards';
import { UpdatePriceBandRequest } from '../requests';

@Controller('admin/monetization/price-bands')
@UseGuards(AuthorPricingFeatureGuard)
@RequirePermissions(PermissionCode.MONETIZATION_PRICE_BAND_MANAGE)
export class AdminMonetizationController {
  constructor(
    private readonly listPriceBands: ListPriceBandsQueryHandler,
    private readonly updatePriceBand: UpdatePriceBandCommandHandler,
  ) {}

  @Get()
  listAll() {
    return this.listPriceBands.execute(new ListPriceBandsQuery(false));
  }

  @Patch(':priceBandId')
  update(
    @CurrentUserId() actorId: string | undefined,
    @Param('priceBandId', new ParseUUIDPipe({ version: '4' }))
    priceBandId: string,
    @Body() request: UpdatePriceBandRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return this.updatePriceBand.execute(
      new UpdatePriceBandCommand(
        actorId,
        priceBandId,
        request.label,
        request.creditPrice,
        request.isActive,
        request.sortOrder,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
