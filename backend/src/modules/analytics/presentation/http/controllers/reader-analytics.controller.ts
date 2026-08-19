import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalyticsConfig } from '@/config';
import { ClientIp, CurrentUserId, Public } from '@/common/decorators';
import { OptionalJwtAuthGuard } from '@/common/guards';
import {
  IngestReaderAnalyticsCommand,
  IngestReaderAnalyticsCommandHandler,
} from '../../../application';
import { IngestReaderAnalyticsRequest } from '../requests/ingest-reader-analytics.request';

@Controller('reader-analytics')
export class ReaderAnalyticsController {
  constructor(
    private readonly ingestion: IngestReaderAnalyticsCommandHandler,
    private readonly config: ConfigService,
  ) {}

  @Get('config')
  @Public()
  configView() {
    const config = this.config.getOrThrow<AnalyticsConfig>('analytics');
    return {
      enabled: config.enabled,
      maxBatchSize: config.maxBatchSize,
      completionThresholdPercent: config.completionThresholdPercent,
      progressHeartbeatSeconds: config.progressHeartbeatSeconds,
    };
  }

  @Post('events')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Body() request: IngestReaderAnalyticsRequest,
  ) {
    return this.ingestion.execute(
      new IngestReaderAnalyticsCommand({
        userId,
        anonymousReaderId: request.anonymousReaderId,
        ipAddress,
        events: request.events,
      }),
    );
  }
}
