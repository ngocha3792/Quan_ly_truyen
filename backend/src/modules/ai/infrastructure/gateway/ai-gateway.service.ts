import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  AppException,
  BusinessRuleViolationException,
  ExternalServiceException,
  RateLimitExceededException,
  RequestTimeoutException,
} from '@/common/exceptions';
import { AiErrorCode, AiProtocol } from '../../domain/enums';
import {
  AiGatewayPort,
  AiSystemFallback,
  AiUsageContext,
} from '../../application/ports/ai-gateway.port';
import {
  ResolvedAiConnection,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProtocolRequestError,
  AiStreamEvent,
} from '../../application/ports/ai-protocol-adapter.port';
import {
  AI_USAGE_PERSISTENCE_PORT,
  AiUsageCapabilityValue,
  AiUsagePersistencePort,
} from '../../application/ports/ai-usage.persistence.port';
import {
  AI_PROTOCOL_REGISTRY_PORT,
  AiProtocolRegistryPort,
} from '../../application/ports/ai-protocol-registry.port';
import { AiRateLimiter } from '../../application/policy/ai-rate-limiter';
import { normalizeAiUsageToken } from '../../application/usage';

interface RecordUsageParams {
  readonly usageContext: AiUsageContext;
  readonly capability: AiUsageCapabilityValue;
  readonly protocol: AiProtocol;
  readonly vendorHint: string | null;
  readonly model: string;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly errorCode?: AiErrorCode;
}

@Injectable()
export class AiGatewayService implements AiGatewayPort {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    @Inject(AI_PROTOCOL_REGISTRY_PORT)
    private readonly registry: AiProtocolRegistryPort,
    @Inject(AI_USAGE_PERSISTENCE_PORT)
    private readonly usagePersistence: AiUsagePersistencePort,
    private readonly rateLimits: AiRateLimiter,
  ) {}

  async generate(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability: AiUsageCapabilityValue = 'CHAT',
    systemFallback?: AiSystemFallback | null,
  ): Promise<AiGenerateResponse> {
    const reservation = await this.rateLimits.reserve(
      usageContext.userId,
      request,
    );
    let result: AiGenerateResponse | undefined;

    try {
      result = await this.generateAttempt(
        connection,
        request,
        usageContext,
        capability,
      );
      return result;
    } catch (error) {
      if (!systemFallback) throw error;

      this.logger.warn({
        event: 'ai.system-fallback.activated',
        userId: usageContext.userId,
        capability,
        primaryConnectionId: usageContext.connectionId,
        fallbackConnectionId: systemFallback.connectionId,
        primaryProtocol: connection.protocol,
        fallbackProtocol: systemFallback.connection.protocol,
        reasonCode: this.errorCode(error),
      });

      result = await this.generateAttempt(
        systemFallback.connection,
        request,
        {
          userId: usageContext.userId,
          connectionId: systemFallback.connectionId,
        },
        capability,
      );
      return result;
    } finally {
      await this.rateLimits.reconcile(
        reservation,
        result?.usage,
        result?.content ?? '',
      );
    }
  }

  async *generateStream(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability: AiUsageCapabilityValue = 'CHAT',
    systemFallback?: AiSystemFallback | null,
  ): AsyncIterable<AiStreamEvent> {
    const reservation = await this.rateLimits.reserve(
      usageContext.userId,
      request,
    );
    let activeConnection = connection;
    let activeUsageContext = usageContext;
    let pendingFallback = systemFallback ?? null;
    let completedUsage:
      | { readonly inputTokens?: number; readonly outputTokens?: number }
      | undefined;
    let completedText = '';

    try {
      for (;;) {
        const startedAt = Date.now();
        const adapter = this.registry.getAdapter(activeConnection.protocol);
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;
        let attemptText = '';

        try {
          const effectiveRequest = this.applyConnectionCapabilities(
            activeConnection,
            request,
            capability,
            true,
          );
          for await (const event of adapter.generateStream(
            activeConnection,
            effectiveRequest,
          )) {
            if (event.type === 'USAGE') {
              inputTokens = event.usage.inputTokens ?? inputTokens;
              outputTokens = event.usage.outputTokens ?? outputTokens;
              yield event;
              continue;
            }

            if (event.type === 'TEXT_DELTA') {
              attemptText += event.text;
              yield event;
            }
          }

          if (!attemptText.trim()) {
            throw new AiProtocolRequestError(
              'AI stream không trả về nội dung phản hồi',
              null,
              AiErrorCode.INVALID_RESPONSE,
            );
          }

          completedUsage = { inputTokens, outputTokens };
          completedText = attemptText;
          await this.recordUsage({
            usageContext: activeUsageContext,
            capability,
            protocol: activeConnection.protocol,
            vendorHint: activeConnection.vendorHint,
            model: activeConnection.model,
            latencyMs: Date.now() - startedAt,
            success: true,
            inputTokens,
            outputTokens,
          });
          this.logAttempt({
            usageContext: activeUsageContext,
            capability,
            protocol: activeConnection.protocol,
            vendorHint: activeConnection.vendorHint,
            model: activeConnection.model,
            latencyMs: Date.now() - startedAt,
            success: true,
            inputTokens,
            outputTokens,
          });
          yield { type: 'DONE' };
          return;
        } catch (error) {
          const failedAttempt: RecordUsageParams = {
            usageContext: activeUsageContext,
            capability,
            protocol: activeConnection.protocol,
            vendorHint: activeConnection.vendorHint,
            model: activeConnection.model,
            latencyMs: Date.now() - startedAt,
            success: false,
            inputTokens,
            outputTokens,
            errorCode:
              error instanceof AiProtocolRequestError
                ? error.code
                : AiErrorCode.UNKNOWN,
          };
          await this.recordUsage(failedAttempt);
          this.logAttempt(failedAttempt);

          if (pendingFallback && attemptText.length === 0) {
            this.logger.warn({
              event: 'ai.system-fallback.activated',
              userId: usageContext.userId,
              capability,
              primaryConnectionId: activeUsageContext.connectionId,
              fallbackConnectionId: pendingFallback.connectionId,
              primaryProtocol: activeConnection.protocol,
              fallbackProtocol: pendingFallback.connection.protocol,
              reasonCode: this.errorCode(error),
            });
            activeConnection = pendingFallback.connection;
            activeUsageContext = {
              userId: usageContext.userId,
              connectionId: pendingFallback.connectionId,
            };
            pendingFallback = null;
            continue;
          }

          throw this.toDomainException(error, activeConnection);
        }
      }
    } finally {
      await this.rateLimits.reconcile(
        reservation,
        completedUsage,
        completedText,
      );
    }
  }

  private async generateAttempt(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
    usageContext: AiUsageContext,
    capability: AiUsageCapabilityValue,
  ): Promise<AiGenerateResponse> {
    const startedAt = Date.now();

    try {
      const effectiveRequest = this.applyConnectionCapabilities(
        connection,
        request,
        capability,
        false,
      );
      const adapter = this.registry.getAdapter(connection.protocol);
      const result = await adapter.generate(connection, effectiveRequest);

      await this.recordUsage({
        usageContext,
        capability,
        protocol: connection.protocol,
        vendorHint: connection.vendorHint,
        model: connection.model,
        latencyMs: result.latencyMs,
        success: true,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });
      this.logAttempt({
        usageContext,
        capability,
        protocol: connection.protocol,
        vendorHint: connection.vendorHint,
        model: connection.model,
        latencyMs: result.latencyMs,
        success: true,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });

      return result;
    } catch (error) {
      const failedAttempt: RecordUsageParams = {
        usageContext,
        capability,
        protocol: connection.protocol,
        vendorHint: connection.vendorHint,
        model: connection.model,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorCode:
          error instanceof AiProtocolRequestError
            ? error.code
            : AiErrorCode.UNKNOWN,
      };
      await this.recordUsage(failedAttempt);
      this.logAttempt(failedAttempt);

      throw this.toDomainException(error, connection);
    }
  }

  private logAttempt(params: RecordUsageParams): void {
    const event = {
      event: 'ai.protocol-attempt.completed',
      userId: params.usageContext.userId,
      connectionId: params.usageContext.connectionId,
      capability: params.capability,
      protocol: params.protocol,
      vendorHint: params.vendorHint,
      model: params.model,
      latencyMs: params.latencyMs,
      success: params.success,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      errorCode: params.errorCode,
    };

    if (params.success) this.logger.log(event);
    else this.logger.warn(event);
  }

  private applyConnectionCapabilities(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
    usageCapability: AiUsageCapabilityValue,
    streaming: boolean,
  ): AiGenerateRequest {
    const capabilities = connection.capabilities;
    const unsupported =
      capabilities?.chat === false
        ? 'chat'
        : streaming && capabilities?.streaming === false
          ? 'streaming'
          : request.systemPrompt &&
              capabilities?.systemPrompt === false &&
              usageCapability !== 'CHAT'
            ? 'systemPrompt'
            : null;

    if (unsupported) {
      throw new BusinessRuleViolationException({
        message: `Kết nối AI này đã được xác nhận không hỗ trợ ${unsupported}. Hãy chọn kết nối hoặc model khác.`,
        rule: 'ai-connection.capability-unsupported',
        details: { capability: unsupported, model: connection.model },
      });
    }

    if (!request.systemPrompt || capabilities?.systemPrompt !== false) {
      return request;
    }

    this.logger.warn({
      event: 'ai.capability-degradation.applied',
      protocol: connection.protocol,
      vendorHint: connection.vendorHint,
      model: connection.model,
      capability: 'systemPrompt',
    });

    return {
      messages: request.messages,
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...(request.maxOutputTokens !== undefined
        ? { maxOutputTokens: request.maxOutputTokens }
        : {}),
      ...(request.timeoutMs !== undefined
        ? { timeoutMs: request.timeoutMs }
        : {}),
    };
  }

  private errorCode(error: unknown): string {
    if (error instanceof AppException) return error.code;
    if (error instanceof AiProtocolRequestError) return error.code;
    return AiErrorCode.UNKNOWN;
  }

  private async recordUsage(params: RecordUsageParams): Promise<void> {
    try {
      await this.usagePersistence.record({
        userId: params.usageContext.userId,
        connectionId: params.usageContext.connectionId,
        protocol: params.protocol,
        vendorHint: params.vendorHint,
        model: params.model,
        capability: params.capability,
        inputTokens: normalizeAiUsageToken(params.inputTokens),
        outputTokens: normalizeAiUsageToken(params.outputTokens),
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
    connection: ResolvedAiConnection,
  ): AppException {
    const label = connection.vendorHint ?? connection.protocol;

    if (error instanceof AiProtocolRequestError) {
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

        case AiErrorCode.INSUFFICIENT_CREDIT:
          return new BusinessRuleViolationException({
            message: `Kết nối ${label} không còn đủ số dư để thực hiện yêu cầu.`,
            rule: 'ai-connection.insufficient-credit',
          });

        case AiErrorCode.MODEL_NOT_FOUND:
          return new BusinessRuleViolationException({
            message: `Model không tồn tại hoặc bạn không có quyền dùng model này trên ${label}.`,
            rule: 'ai-connection.model-not-found',
          });

        case AiErrorCode.MODEL_NOT_ALLOWED:
          return new BusinessRuleViolationException({
            message: `Kết nối ${label} không được phép sử dụng model này.`,
            rule: 'ai-connection.model-not-allowed',
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
