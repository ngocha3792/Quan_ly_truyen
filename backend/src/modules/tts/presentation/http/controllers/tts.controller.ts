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
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUserId,
  Idempotent,
  RequirePermissions,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  CreateTtsConnectionCommandHandler,
  DeleteTtsConnectionCommandHandler,
  GenerateTtsManifestCommandHandler,
  GetTtsManifestQueryHandler,
  GetTtsQuotaQueryHandler,
  ListTtsConnectionsQueryHandler,
  type TtsConnectionDto,
  type TtsManifestDto,
  type TtsQuotaDto,
} from '../../../application';
import { TtsFeatureGuard } from '../guards';
import {
  CreateTtsConnectionRequest,
  GenerateTtsManifestRequest,
} from '../requests';

@Controller('tts')
@UseGuards(TtsFeatureGuard)
export class TtsController {
  constructor(
    private readonly createConnection: CreateTtsConnectionCommandHandler,
    private readonly listConnections: ListTtsConnectionsQueryHandler,
    private readonly deleteConnection: DeleteTtsConnectionCommandHandler,
    private readonly generateManifest: GenerateTtsManifestCommandHandler,
    private readonly getManifest: GetTtsManifestQueryHandler,
    private readonly getQuota: GetTtsQuotaQueryHandler,
  ) {}

  @Post('connections')
  @RequirePermissions(PermissionCode.TTS_CONNECTION_MANAGE_SELF)
  create(
    @CurrentUserId() userId: string | undefined,
    @Body() request: CreateTtsConnectionRequest,
  ): Promise<TtsConnectionDto> {
    return this.createConnection.execute({
      actorUserId: userId ?? '',
      system: false,
      ...request,
    });
  }

  @Get('connections')
  @RequirePermissions(PermissionCode.TTS_CONNECTION_MANAGE_SELF)
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly TtsConnectionDto[]> {
    return this.listConnections.execute(userId);
  }

  @Delete('connections/:connectionId')
  @RequirePermissions(PermissionCode.TTS_CONNECTION_MANAGE_SELF)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string | undefined,
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ): Promise<void> {
    return this.deleteConnection.execute(userId, connectionId);
  }

  @Post('manifests')
  @RequirePermissions(PermissionCode.TTS_GENERATE_SELF)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  generate(
    @CurrentUserId() userId: string | undefined,
    @Body() request: GenerateTtsManifestRequest,
  ): Promise<TtsManifestDto> {
    return this.generateManifest.execute({ userId, ...request });
  }

  @Get('manifests/:manifestId')
  @RequirePermissions(PermissionCode.TTS_GENERATE_SELF)
  @Header('Cache-Control', 'private, no-store')
  manifest(
    @CurrentUserId() userId: string | undefined,
    @Param('manifestId', new ParseUUIDPipe({ version: '4' }))
    manifestId: string,
  ): Promise<TtsManifestDto> {
    return this.getManifest.execute(userId, manifestId);
  }

  @Get('quota')
  @RequirePermissions(PermissionCode.TTS_GENERATE_SELF)
  @Header('Cache-Control', 'private, no-store')
  quota(@CurrentUserId() userId: string | undefined): Promise<TtsQuotaDto> {
    return this.getQuota.execute(userId);
  }
}
