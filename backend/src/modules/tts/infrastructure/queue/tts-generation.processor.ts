import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';

import { AppException } from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  GENERATE_TTS_MANIFEST_JOB,
  isGenerateTtsManifestJobV1,
  type GenerateTtsManifestJobV1,
} from '@/infrastructure/queue/contracts';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';
import { MEDIA_STORAGE, type MediaStoragePort } from '@/modules/media';

import {
  TTS_CREDENTIAL_VAULT_PORT,
  TTS_PERSISTENCE_PORT,
  TTS_PROVIDER_PORT,
  type TtsCredentialVaultPort,
  type TtsGenerationConnection,
  type TtsPersistencePort,
  type TtsProviderPort,
} from '../../application';

@Processor(QUEUE_NAMES.TTS, { concurrency: getWorkerConcurrency() })
export class TtsGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(TtsGenerationProcessor.name);

  constructor(
    @Inject(TTS_PERSISTENCE_PORT)
    private readonly persistence: TtsPersistencePort,
    @Inject(TTS_CREDENTIAL_VAULT_PORT)
    private readonly vault: TtsCredentialVaultPort,
    @Inject(TTS_PROVIDER_PORT) private readonly provider: TtsProviderPort,
    @Inject(MEDIA_STORAGE) private readonly media: MediaStoragePort,
  ) {
    super();
  }

  async process(job: Job<GenerateTtsManifestJobV1>): Promise<void> {
    if (
      job.name !== GENERATE_TTS_MANIFEST_JOB ||
      !isGenerateTtsManifestJobV1(job.data)
    ) {
      throw new UnrecoverableError(`Unsupported TTS job: ${job.name}`);
    }
    const work = await this.persistence.claimGeneration(
      job.data.manifestId,
      new Date(),
    );
    if (!work) return;

    try {
      for (const segment of work.segments) {
        if (segment.status === 'GENERATED') continue;
        try {
          const generated = await this.generateWithPolicy(
            segment.blockText,
            work.connection,
            work.systemFallback,
          );
          const stored = await this.media.uploadBuffer({
            buffer: generated.audioBuffer,
            assetFolder: 'tts',
            publicId: `${work.manifestId}/${segment.id}`,
            resourceType: 'video',
          });
          await this.persistence.completeSegment({
            segmentId: segment.id,
            audioPublicId: stored.publicId,
            durationMs: generated.durationMs,
            sizeBytes: BigInt(stored.bytes),
            format: generated.format,
            wordTimings: generated.wordTimings,
            usedSystemFallback: generated.usedSystemFallback,
          });
        } catch (error) {
          await this.persistence.failSegment(segment.id, errorMessage(error));
          throw error;
        }
      }
      await this.persistence.completeManifest(work.manifestId, new Date());
    } catch (error) {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const retryable = !(error instanceof AppException) || error.retryable;
      if (finalAttempt || !retryable) {
        await this.persistence.failManifest(
          work.manifestId,
          errorMessage(error),
          new Date(),
        );
        if (!retryable) throw new UnrecoverableError(errorMessage(error));
      }
      this.logger.warn({
        event: 'tts.generation.failed',
        manifestId: work.manifestId,
        retryable,
        finalAttempt,
      });
      throw error;
    }
  }

  private async generateWithPolicy(
    text: string,
    primary: TtsGenerationConnection,
    fallback: TtsGenerationConnection | null,
  ) {
    try {
      return {
        ...(await this.generate(text, primary)),
        usedSystemFallback: false,
      };
    } catch (error) {
      if (!fallback) throw error;
      this.logger.warn({
        event: 'tts.system-fallback.used',
        primaryConnectionId: primary.id,
        fallbackConnectionId: fallback.id,
      });
      return {
        ...(await this.generate(text, fallback)),
        usedSystemFallback: true,
      };
    }
  }

  private async generate(text: string, connection: TtsGenerationConnection) {
    return this.provider.generate({
      apiKey: await this.vault.decrypt(connection.encryptedApiKey),
      text,
      voiceId: connection.voiceId,
      language: connection.language,
      stability: connection.stability,
      similarity: connection.similarity,
      style: connection.style,
    });
  }
}

function errorMessage(error: unknown): string {
  return (
    error instanceof Error ? error.message : 'Tạo audio TTS thất bại'
  ).slice(0, 1_000);
}
