import {
  AiErrorCode,
  classifyAiErrorStatus,
  type AiProvider,
} from '../../domain/enums';

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

export interface AiUsageTokens {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export interface AiGenerateResponse {
  readonly content: string;
  readonly provider: AiProvider;
  readonly model: string;
  readonly latencyMs: number;
  readonly usage?: AiUsageTokens;
}

export interface AiConnectionTestResult {
  readonly ok: boolean;
  readonly message?: string;
}

export type AiStreamDelta =
  { readonly text: string } | { readonly usage: AiUsageTokens };

export class AiProviderRequestError extends Error {
  readonly code: AiErrorCode;

  constructor(
    message: string,
    readonly upstreamStatus: number | null,
  ) {
    super(message);
    this.name = 'AiProviderRequestError';
    this.code = classifyAiErrorStatus(upstreamStatus);
  }
}

export interface AiProviderClientPort {
  generate(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse>;

  generateStream(
    config: AiConnectionConfig,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamDelta>;

  testConnection(config: AiConnectionConfig): Promise<AiConnectionTestResult>;

  listModels(config: AiConnectionConfig): Promise<readonly string[]>;
}
