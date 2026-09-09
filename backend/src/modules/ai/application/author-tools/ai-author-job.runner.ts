import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '@/common/exceptions';
import { AI_GATEWAY_PORT, AiGatewayPort } from '../ports/ai-gateway.port';
import {
  AI_AUTHOR_PERSISTENCE_PORT,
  AiAuthorPersistencePort,
} from './ai-author.persistence.port';
import { AiAuthorConnectionResolver } from './ai-author-connection.resolver';
import { AuthorJobError } from './ai-author.types';
import {
  assertSourceUnchanged,
  buildAuthorPrompt,
  parseAuthorOutput,
} from './ai-author-output';
import { normalizeAiUsageToken } from '../usage';

@Injectable()
export class AiAuthorJobRunner {
  private readonly logger = new Logger(AiAuthorJobRunner.name);
  constructor(
    @Inject(AI_AUTHOR_PERSISTENCE_PORT)
    private readonly persistence: AiAuthorPersistencePort,
    private readonly connections: AiAuthorConnectionResolver,
    @Inject(AI_GATEWAY_PORT) private readonly gateway: AiGatewayPort,
  ) {}
  async execute(id: string): Promise<void> {
    const job = await this.persistence.claim(id, randomUUID());
    if (!job) return;
    try {
      await this.persistence.assertAccess(job.userId, job.storyId);
      const source = await this.persistence.source({
        ...job,
        chapterId: job.chapterId ?? undefined,
      });
      assertSourceUnchanged(job.sourceSnapshot, source);
      const connection = await this.connections.execution(
        job.userId,
        job.connectionId,
      );
      const response = await this.gateway.generate(
        connection.primary,
        {
          includeExecutionMetadata: true,
          temperature: 0.2,
          maxOutputTokens: 4000,
          timeoutMs: 30_000,
          messages: [
            {
              role: 'user',
              content: buildAuthorPrompt(job.jobType, source, job.chapterId),
            },
          ],
        },
        { userId: job.userId, connectionId: job.connectionId },
        job.jobType.endsWith('SUMMARY') ? 'SUMMARY' : 'REWRITE',
        connection.fallback,
      );
      const result = parseAuthorOutput(
        job.jobType,
        response.content,
        job.sourceSnapshot,
        job.chapterId,
      );
      await this.persistence.complete(job, result, {
        inputTokens: normalizeAiUsageToken(response.usage?.inputTokens) ?? null,
        outputTokens:
          normalizeAiUsageToken(response.usage?.outputTokens) ?? null,
        protocol: response.execution?.protocol ?? response.protocol,
        model: response.execution?.model ?? response.model,
        connectionId: response.execution?.connectionId ?? null,
      });
    } catch (error) {
      const code =
        error instanceof AuthorJobError
          ? error.code
          : error instanceof AppException
            ? error.code
            : 'PROCESSING_FAILED';
      await this.persistence.fail(job, code);
      // Provider error text can contain echoed drafts. Only allowlisted codes are persisted/logged.
      this.logger.warn({
        event: 'ai.author-job.failed',
        jobId: job.id,
        jobType: job.jobType,
        errorCode: code,
      });
    }
  }
}
