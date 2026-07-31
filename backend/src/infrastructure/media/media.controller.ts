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
import { CurrentUser } from '@/common/decorators/auth';
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
  createIntent(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateMediaUploadIntentDto,
  ) {
    return this.mediaService.createUploadIntent({ uploaderId: userId, ...dto });
  }

  @Post('upload-intents/:mediaAssetId/confirm')
  async confirm(
    @CurrentUser('userId') userId: string,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
    @Body() dto: ConfirmMediaUploadDto,
  ): Promise<MediaResponseDto> {
    const media = await this.mediaService.confirmUpload({
      userId,
      mediaAssetId,
      dto,
    });
    return toMediaResponse(media, this.queryService.getDeliveryUrl(media));
  }

  @Get(':mediaAssetId')
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<MediaResponseDto> {
    const media = await this.queryService.getAccessibleById(
      mediaAssetId,
      userId,
    );
    return toMediaResponse(media, this.queryService.getDeliveryUrl(media));
  }

  @Delete(':mediaAssetId')
  @HttpCode(204)
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<void> {
    await this.cleanupService.deleteById(mediaAssetId, userId);
  }
}
