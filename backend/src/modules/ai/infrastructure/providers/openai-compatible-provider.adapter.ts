import { Injectable } from '@nestjs/common';

import {
  ResolvedAiConnection,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProtocolAdapter,
  AiStreamDelta,
} from '../../application/ports/ai-protocol-adapter.port';
import { assertPublicHttpsUrl } from '../security/ssrf-guard.util';
import {
  openAiCompatibleGenerate,
  openAiCompatibleGenerateStream,
  openAiCompatibleListModels,
  openAiCompatibleTestConnection,
} from './openai-compatible.core';
import { normalizeProtocolBaseUrl } from './protocol-base-url.util';

@Injectable()
export class OpenAiChatCompletionsProtocolAdapter implements AiProtocolAdapter {
  async generate(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    return openAiCompatibleGenerate(connection, request, baseUrl);
  }

  async *generateStream(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamDelta> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    yield* openAiCompatibleGenerateStream(connection, request, baseUrl);
  }

  async testConnection(
    connection: ResolvedAiConnection,
  ): Promise<AiConnectionTestResult> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    return openAiCompatibleTestConnection(connection, baseUrl);
  }

  async listModels(
    connection: ResolvedAiConnection,
  ): Promise<readonly string[]> {
    const baseUrl = await this.requireGuardedBaseUrl(connection);
    return openAiCompatibleListModels(connection, baseUrl);
  }

  private async requireGuardedBaseUrl(
    connection: ResolvedAiConnection,
  ): Promise<string> {
    const url = await assertPublicHttpsUrl(connection.baseUrl);
    return normalizeProtocolBaseUrl(url, 'v1');
  }
}
