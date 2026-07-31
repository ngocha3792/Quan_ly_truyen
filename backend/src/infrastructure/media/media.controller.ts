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
import { PermissionCode } from '@/common/enums';
import type { AuthPrincipal } from '@/common/interfaces/auth';
import { MediaCleanupService } from './application/media-cleanup.service';
import { MediaQueryService } from './application/media-query.service';
import { MediaService } from './application/media.service';
import { ConfirmMediaUploadDto } from './dto/confirm-media-upload.dto';
import { CreateMediaUploadIntentDto } from './dto/create-media-upload-intent.dto';
import {
  toMediaResponse,
  type MediaResponseDto,
} from './dto/media-response.dto';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly queryService: MediaQueryService,
    private readonly cleanupService: MediaCleanupService,
  ) {}

  @Post('upload-intents')
  @Permissions(PermissionCode.MEDIA_UPLOAD)
  createIntent(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: CreateMediaUploadIntentDto,
  ) {
    return this.mediaService.createUploadIntent({ principal, ...dto });
  }

  @Post('upload-intents/:mediaAssetId/confirm')
  @Permissions(PermissionCode.MEDIA_UPLOAD)
  async confirm(
    @CurrentUser() principal: AuthPrincipal,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
    @Body() dto: ConfirmMediaUploadDto,
  ): Promise<MediaResponseDto> {
    const media = await this.mediaService.confirmUpload({
      principal,
      mediaAssetId,
      dto,
    });
    return toMediaResponse(media, this.queryService.getDeliveryUrl(media));
  }

  @Get(':mediaAssetId')
  async findOne(
    @CurrentUser() principal: AuthPrincipal,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<MediaResponseDto> {
    const media = await this.queryService.getAccessibleById(
      mediaAssetId,
      principal,
    );
    return toMediaResponse(media, this.queryService.getDeliveryUrl(media));
  }

  @Delete(':mediaAssetId')
  @HttpCode(204)
  async remove(
    @CurrentUser() principal: AuthPrincipal,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<void> {
    await this.cleanupService.deleteById(mediaAssetId, principal);
  }
}
