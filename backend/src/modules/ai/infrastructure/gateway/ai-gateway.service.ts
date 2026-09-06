import { Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationException,
  ExternalServiceException,
} from '@/common/exceptions';
import { AiProvider } from '@/generated/prisma/client';

import { AiGatewayPort } from '../../application/ports/ai-gateway.port';
import {
  AiConnectionConfig,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderRequestError,
} from '../../application/ports/ai-provider-client.port';
import { AiProviderRegistry } from '../providers/ai-provider.registry';

const PROVIDER_LABELS: Record<AiProvider, string> = {
  [AiProvider.GEMINI]: 'Gemini',
  [AiProvider.OPENAI]: 'ChatGPT',
  [AiProvider.ANTHROPIC]: 'Claude',
  [AiProvider.OPENAI_COMPATIBLE]: 'AI (OpenAI Compatible)',
};

@Injectable()
export class AiGatewayService implements AiGatewayPort {
  constructor(private readonly registry: AiProviderRegistry) {}

  async generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    try {
      const client = this.registry.getClient(config.provider);
      return await client.generate(config, request);
    } catch (error) {
      throw this.toDomainException(error, config.provider);
    }
  }

  private toDomainException(
    error: unknown,
    provider: AiProvider,
  ): BusinessRuleViolationException | ExternalServiceException {
    const label = PROVIDER_LABELS[provider];

    if (error instanceof AiProviderRequestError) {
      if (error.upstreamStatus === 401 || error.upstreamStatus === 403) {
        return new BusinessRuleViolationException({
          message: `API key ${label} không hợp lệ hoặc đã bị từ chối. Vui lòng kiểm tra lại API key.`,
          rule: 'ai-connection.key-rejected',
        });
      }

      return new ExternalServiceException({
        service: label,
        message: error.message,
        upstreamStatus: error.upstreamStatus ?? undefined,
        cause: error,
      });
    }

    if (
      error instanceof BusinessRuleViolationException ||
      error instanceof ExternalServiceException
    ) {
      return error;
    }

    return new ExternalServiceException({ service: label, cause: error });
  }
}
