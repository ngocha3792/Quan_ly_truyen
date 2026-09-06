import { Inject, Injectable } from '@nestjs/common';

import {
  AppException,
  BusinessRuleViolationException,
  ExternalServiceException,
  RateLimitExceededException,
  RequestTimeoutException,
} from '@/common/exceptions';
import { AiProvider } from '@/generated/prisma/client';

import { AiErrorCode } from '../../domain/errors/ai-error-code.enum';
import {
  AiGatewayPort,
  AiUsageContext,
} from '../../application/ports/ai-gateway.port';
import {
  AiConnectionConfig,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderRequestError,
  AiStreamDelta,
} from '../../application/ports/ai-provider-client.port';
import {
  AI_USAGE_PERSISTENCE_PORT,
  AiUsagePersistencePort,
} from '../../application/ports/ai-usage.persistence.port';
import { AiProviderRegistry } from '../providers/ai-provider.registry';

const PROVIDER_LABELS: Record<AiProvider, string> = {
  [AiProvider.GEMINI]: 'Gemini',
  [AiProvider.OPENAI]: 'ChatGPT',
  [AiProvider.ANTHROPIC]: 'Claude',
  [AiProvider.OPENAI_COMPATIBLE]: 'AI (OpenAI Compatible)',
};

interface RecordUsageParams {
  readonly usageContext: AiUsageContext;
  readonly provider: AiProvider;
  readonly model: string;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly errorCode?: AiErrorCode;
}

@Injectable()
export class AiGatewayService implements AiGatewayPort {
  constructor(
    private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_PERSISTENCE_PORT)
    private readonly usagePersistence: AiUsagePersistencePort,
  ) {}

  async generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
  ): Promise<AiGenerateResponse> {
    const startedAt = Date.now();

    try {
      const client = this.registry.getClient(config.provider);
      const result = await client.generate(config, request);

      await this.recordUsage({
        usageContext,
        provider: config.provider,
        model: config.model,
        latencyMs: result.latencyMs,
        success: true,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });

      return result;
    } catch (error) {
      await this.recordUsage({
        usageContext,
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorCode:
          error instanceof AiProviderRequestError
            ? error.code
            : AiErrorCode.UNKNOWN,
      });

      throw this.toDomainException(error, config.provider);
    }
  }

  async *generateStream(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
  ): AsyncIterable<AiStreamDelta> {
    const startedAt = Date.now();
    const client = this.registry.getClient(config.provider);

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    try {
      for await (const delta of client.generateStream(config, request)) {
        if ('usage' in delta) {
          inputTokens = delta.usage.inputTokens ?? inputTokens;
          outputTokens = delta.usage.outputTokens ?? outputTokens;
        }

        yield delta;
      }

      await this.recordUsage({
        usageContext,
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        success: true,
        inputTokens,
        outputTokens,
      });
    } catch (error) {
      await this.recordUsage({
        usageContext,
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        success: false,
        inputTokens,
        outputTokens,
        errorCode:
          error instanceof AiProviderRequestError
            ? error.code
            : AiErrorCode.UNKNOWN,
      });

      throw this.toDomainException(error, config.provider);
    }
  }

  private async recordUsage(params: RecordUsageParams): Promise<void> {
    try {
      await this.usagePersistence.record({
        userId: params.usageContext.userId,
        connectionId: params.usageContext.connectionId,
        provider: params.provider,
        model: params.model,
        capability: 'CHAT',
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        latencyMs: params.latencyMs,
        success: params.success,
        errorCode: params.errorCode,
      });
    } catch {
      // Usage logging is best-effort and must never break the chat response.
    }
  }

  private toDomainException(
    error: unknown,
    provider: AiProvider,
  ): AppException {
    const label = PROVIDER_LABELS[provider];

    if (error instanceof AiProviderRequestError) {
      switch (error.code) {
        case AiErrorCode.RATE_LIMITED:
          return new RateLimitExceededException({
            message: `${label} đang giới hạn tốc độ yêu cầu. Vui lòng thử lại sau ít phút.`,
          });

        case AiErrorCode.TIMEOUT:
          return new RequestTimeoutException({
            message: `Kết nối tới ${label} quá thời gian chờ.`,
            operation: 'ai.generate',
          });

        case AiErrorCode.INVALID_CREDENTIALS:
          return new BusinessRuleViolationException({
            message: `API key ${label} không hợp lệ hoặc đã bị từ chối. Vui lòng kiểm tra lại API key.`,
            rule: 'ai-connection.key-rejected',
          });

        case AiErrorCode.MODEL_NOT_FOUND:
          return new BusinessRuleViolationException({
            message: `Model không tồn tại hoặc bạn không có quyền dùng model này trên ${label}.`,
            rule: 'ai-connection.model-not-found',
          });

        case AiErrorCode.CONTEXT_TOO_LARGE:
          return new BusinessRuleViolationException({
            message:
              'Nội dung cuộc trò chuyện quá dài. Hãy bắt đầu một cuộc trò chuyện mới.',
            rule: 'ai-connection.context-too-large',
          });

        case AiErrorCode.PROVIDER_UNAVAILABLE:
        case AiErrorCode.INVALID_RESPONSE:
        case AiErrorCode.UNKNOWN:
        default:
          return new ExternalServiceException({
            service: label,
            message: error.message,
            upstreamStatus: error.upstreamStatus ?? undefined,
            cause: error,
          });
      }
    }

    if (
      error instanceof BusinessRuleViolationException ||
      error instanceof ExternalServiceException ||
      error instanceof RateLimitExceededException ||
      error instanceof RequestTimeoutException
    ) {
      return error;
    }

    return new ExternalServiceException({ service: label, cause: error });
  }
}
