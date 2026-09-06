import { Injectable } from '@nestjs/common';

import { BusinessRuleViolationException } from '@/common/exceptions';

import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderClientPort,
  AiStreamDelta,
} from '../../application/ports/ai-provider-client.port';
import { assertPublicHttpsUrl } from '../security/ssrf-guard.util';
import {
  openAiCompatibleGenerate,
  openAiCompatibleGenerateStream,
  openAiCompatibleListModels,
  openAiCompatibleTestConnection,
} from './openai-compatible.core';

@Injectable()
export class OpenAiCompatibleProviderAdapter implements AiProviderClientPort {
  async generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    const baseUrl = await this.requireGuardedBaseUrl(config);
    return openAiCompatibleGenerate(config, request, baseUrl);
  }

  async *generateStream(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamDelta> {
    const baseUrl = await this.requireGuardedBaseUrl(config);
    yield* openAiCompatibleGenerateStream(config, request, baseUrl);
  }

  async testConnection(
    config: AiConnectionConfig,
  ): Promise<AiConnectionTestResult> {
    const baseUrl = await this.requireGuardedBaseUrl(config);
    return openAiCompatibleTestConnection(config, baseUrl);
  }

  async listModels(config: AiConnectionConfig): Promise<readonly string[]> {
    const baseUrl = await this.requireGuardedBaseUrl(config);
    return openAiCompatibleListModels(config, baseUrl);
  }

  private async requireGuardedBaseUrl(
    config: AiConnectionConfig,
  ): Promise<string> {
    if (!config.baseUrl) {
      throw new BusinessRuleViolationException({
        message: 'Kết nối OpenAI Compatible cần khai báo Base URL.',
        rule: 'ai-connection.base-url-required',
      });
    }

    const url = await assertPublicHttpsUrl(config.baseUrl);
    return url.toString().replace(/\/+$/, '');
  }
}
