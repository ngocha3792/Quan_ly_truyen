import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUser, Permissions } from '@/common/decorators/auth';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import type { AuthPrincipal } from '@/common/interfaces/auth';

import {
  ConfirmMediaUploadCommand,
  ConfirmMediaUploadCommandHandler,
  CreateMediaUploadIntentCommand,
  CreateMediaUploadIntentCommandHandler,
  DeleteMediaCommand,
  DeleteMediaCommandHandler,
  GetMediaQuery,
  GetMediaQueryHandler,
} from '../../../application';
import { ConfirmMediaUploadDto } from '../dto/confirm-media-upload.dto';
import { CreateMediaUploadIntentDto } from '../dto/create-media-upload-intent.dto';
import {
  toMediaResponse,
  type MediaResponseDto,
} from '../dto/media-response.dto';

@Controller('media')
export class MediaController {
  constructor(
    private readonly createIntentHandler: CreateMediaUploadIntentCommandHandler,
    private readonly confirmUploadHandler: ConfirmMediaUploadCommandHandler,
    private readonly getMediaHandler: GetMediaQueryHandler,
    private readonly deleteMediaHandler: DeleteMediaCommandHandler,
  ) {}

  @Post('upload-intents')
  @Idempotent()
  @Permissions(PermissionCode.MEDIA_UPLOAD)
  createIntent(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: CreateMediaUploadIntentDto,
  ) {
    return this.createIntentHandler.execute(
      new CreateMediaUploadIntentCommand({ principal, ...dto }),
    );
  }

  @Post('upload-intents/:mediaAssetId/confirm')
  @Permissions(PermissionCode.MEDIA_UPLOAD)
  async confirm(
    @CurrentUser() principal: AuthPrincipal,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
    @Body() dto: ConfirmMediaUploadDto,
  ): Promise<MediaResponseDto> {
    const media = await this.confirmUploadHandler.execute(
      new ConfirmMediaUploadCommand(principal, mediaAssetId, dto),
    );

    return toMediaResponse(media, this.getMediaHandler.deliveryUrl(media));
  }

  @Get(':mediaAssetId')
  async findOne(
    @CurrentUser() principal: AuthPrincipal,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<MediaResponseDto> {
    const media = await this.getMediaHandler.execute(
      new GetMediaQuery(mediaAssetId, principal),
    );

    return toMediaResponse(media, this.getMediaHandler.deliveryUrl(media));
  }

  @Delete(':mediaAssetId')
  @HttpCode(204)
  async remove(
    @CurrentUser() principal: AuthPrincipal,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<void> {
    await this.deleteMediaHandler.execute(
      new DeleteMediaCommand(mediaAssetId, principal),
    );
  }
}
