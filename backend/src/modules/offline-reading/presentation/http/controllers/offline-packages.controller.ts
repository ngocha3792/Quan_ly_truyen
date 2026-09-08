import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentSessionId,
  CurrentUserId,
  Idempotent,
  RequirePermissions,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  CreateOfflinePackageCommand,
  CreateOfflinePackageCommandHandler,
  DeleteOfflinePackageCommand,
  DeleteOfflinePackageCommandHandler,
  GetOfflinePackageManifestQuery,
  GetOfflinePackageManifestQueryHandler,
  GetOfflineQuotaQuery,
  GetOfflineQuotaQueryHandler,
  ListOfflinePackagesQuery,
  ListOfflinePackagesQueryHandler,
  TouchOfflinePackageCommand,
  TouchOfflinePackageCommandHandler,
  type OfflinePackageManifestDto,
  type OfflinePackageSummaryDto,
  type OfflineQuotaDto,
  type TouchOfflinePackageResultDto,
} from '../../../application';
import { OfflineReadingFeatureGuard } from '../guards';
import { CreateOfflinePackageRequest } from '../requests';

@Controller('offline-packages')
@UseGuards(OfflineReadingFeatureGuard)
@RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
export class OfflinePackagesController {
  constructor(
    private readonly createPackageCommand: CreateOfflinePackageCommandHandler,
    private readonly deletePackageCommand: DeleteOfflinePackageCommandHandler,
    private readonly touchPackageCommand: TouchOfflinePackageCommandHandler,
    private readonly listPackagesQuery: ListOfflinePackagesQueryHandler,
    private readonly getQuotaQuery: GetOfflineQuotaQueryHandler,
    private readonly getManifestQuery: GetOfflinePackageManifestQueryHandler,
  ) {}

  @Post()
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @Header('Cache-Control', 'private, no-store')
  create(
    @CurrentUserId() userId: string | undefined,
    @CurrentSessionId() sessionId: string | undefined,
    @Body() request: CreateOfflinePackageRequest,
  ): Promise<OfflinePackageSummaryDto> {
    return this.createPackageCommand.execute(
      new CreateOfflinePackageCommand(
        userId,
        sessionId,
        request.name,
        request.description,
        request.chapterIds,
      ),
    );
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly OfflinePackageSummaryDto[]> {
    return this.listPackagesQuery.execute(new ListOfflinePackagesQuery(userId));
  }

  @Get('quota')
  @Header('Cache-Control', 'private, no-store')
  quota(@CurrentUserId() userId: string | undefined): Promise<OfflineQuotaDto> {
    return this.getQuotaQuery.execute(new GetOfflineQuotaQuery(userId));
  }

  @Get(':packageId/manifest')
  @Header('Cache-Control', 'private, no-store')
  manifest(
    @CurrentUserId() userId: string | undefined,
    @CurrentSessionId() sessionId: string | undefined,
    @Param('packageId', new ParseUUIDPipe({ version: '4' }))
    packageId: string,
  ): Promise<OfflinePackageManifestDto> {
    return this.getManifestQuery.execute(
      new GetOfflinePackageManifestQuery(userId, sessionId, packageId),
    );
  }

  @Patch(':packageId/touch')
  @Header('Cache-Control', 'private, no-store')
  touch(
    @CurrentUserId() userId: string | undefined,
    @CurrentSessionId() sessionId: string | undefined,
    @Param('packageId', new ParseUUIDPipe({ version: '4' }))
    packageId: string,
  ): Promise<TouchOfflinePackageResultDto> {
    return this.touchPackageCommand.execute(
      new TouchOfflinePackageCommand(userId, sessionId, packageId),
    );
  }

  @Delete(':packageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('packageId', new ParseUUIDPipe({ version: '4' }))
    packageId: string,
  ): Promise<void> {
    await this.deletePackageCommand.execute(
      new DeleteOfflinePackageCommand(userId, packageId),
    );
  }
}
