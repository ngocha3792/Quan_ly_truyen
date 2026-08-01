import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import {
  Public,
  SkipRequestLogging,
  SkipResponseEnvelope,
} from '@/common/decorators';

import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

@Controller('internal/metrics')
@Public()
@SkipRequestLogging()
@SkipResponseEnvelope()
@UseGuards(MetricsGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.metrics.registry.contentType);
    response.send(await this.metrics.render());
  }
}
