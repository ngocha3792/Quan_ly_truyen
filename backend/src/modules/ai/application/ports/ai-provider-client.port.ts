import type { AiProvider } from '@/generated/prisma/client';

export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  readonly role: AiMessageRole;
  readonly content: string;
}

export interface AiConnectionConfig {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly baseUrl?: string | null;
  readonly model: string;
}

export interface AiGenerateRequest {
  readonly systemPrompt?: string;
  readonly messages: readonly AiMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface AiGenerateResponse {
  readonly content: string;
  readonly provider: AiProvider;
  readonly model: string;
  readonly latencyMs: number;
}

export interface AiConnectionTestResult {
  readonly ok: boolean;
  readonly message?: string;
}

export class AiProviderRequestError extends Error {
  constructor(
    message: string,
    readonly upstreamStatus: number | null,
  ) {
    super(message);
    this.name = 'AiProviderRequestError';
  }
}

export interface AiProviderClientPort {
  generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse>;

  testConnection(config: AiConnectionConfig): Promise<AiConnectionTestResult>;

  listModels(config: AiConnectionConfig): Promise<readonly string[]>;
}
