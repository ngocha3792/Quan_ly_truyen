import { Injectable } from '@nestjs/common';

import {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderClientPort,
} from '../../application/ports/ai-provider-client.port';
import {
  openAiCompatibleGenerate,
  openAiCompatibleListModels,
  openAiCompatibleTestConnection,
} from './openai-compatible.core';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

@Injectable()
export class OpenAiProviderAdapter implements AiProviderClientPort {
  generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    return openAiCompatibleGenerate(config, request, OPENAI_BASE_URL);
  }

  testConnection(config: AiConnectionConfig): Promise<AiConnectionTestResult> {
    return openAiCompatibleTestConnection(config, OPENAI_BASE_URL);
  }

  listModels(config: AiConnectionConfig): Promise<readonly string[]> {
    return openAiCompatibleListModels(config, OPENAI_BASE_URL);
  }
}
