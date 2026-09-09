import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { ExternalServiceException } from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  GENERATE_TTS_MANIFEST_JOB,
  type GenerateTtsManifestJobV1,
} from '@/infrastructure/queue/contracts';

import type { TtsGenerationQueuePort } from '../../application';

@Injectable()
export class TtsGenerationQueueAdapter implements TtsGenerationQueuePort {
  constructor(
    @Optional() @InjectQueue(QUEUE_NAMES.TTS) private readonly queue?: Queue,
  ) {}

  async enqueue(manifestId: string): Promise<string> {
    if (!this.queue) {
      throw new ExternalServiceException({
        service: 'Hàng đợi TTS',
        code: 'TTS_QUEUE_UNAVAILABLE',
        message: 'Dịch vụ tạo audio hiện không khả dụng',
      });
    }
    const payload: GenerateTtsManifestJobV1 = { version: 1, manifestId };
    const job = await this.queue.add(GENERATE_TTS_MANIFEST_JOB, payload, {
      jobId: manifestId,
    });
    return String(job.id ?? manifestId);
  }
}
