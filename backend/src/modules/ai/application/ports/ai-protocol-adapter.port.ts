import {
  AiAuthType,
  AiErrorCode,
  AiProtocol,
  classifyAiErrorStatus,
} from '../../domain/enums';

export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  readonly role: AiMessageRole;
  readonly content: string;
}

export interface ResolvedAiConnection {
  readonly protocol: AiProtocol;
  readonly vendorHint: string | null;
  readonly baseUrl: string;
  readonly authType: AiAuthType;
  readonly authHeaderName: string | null;
  readonly credential: string;
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
  readonly protocol: AiProtocol;
  readonly model: string;
  readonly latencyMs: number;
  readonly usage?: AiUsageTokens;
}

export interface AiConnectionTestResult {
  readonly ok: boolean;
  readonly message?: string;
}

export interface AiModelInfo {
  readonly id: string;
  readonly displayName?: string;
  readonly contextLength?: number;
  readonly maxOutputTokens?: number;
  readonly reasoning?: boolean;
  readonly vision?: boolean;
  readonly tools?: boolean;
}

export type AiStreamDelta =
  { readonly text: string } | { readonly usage: AiUsageTokens };

export class AiProtocolRequestError extends Error {
  readonly code: AiErrorCode;

  constructor(
    message: string,
    readonly upstreamStatus: number | null,
    code?: AiErrorCode,
  ) {
    super(message);
    this.name = 'AiProtocolRequestError';
    this.code = code ?? classifyAiErrorStatus(upstreamStatus);
  }
}

export interface AiProtocolAdapter {
  generate(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse>;

  generateStream(
    connection: ResolvedAiConnection,
    request: AiGenerateRequest,
  ): AsyncIterable<AiStreamDelta>;

  testConnection(
    connection: ResolvedAiConnection,
  ): Promise<AiConnectionTestResult>;

  listModels(connection: ResolvedAiConnection): Promise<readonly AiModelInfo[]>;
}
