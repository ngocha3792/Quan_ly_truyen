export interface AiChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
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
  sendMessage(
    apiKey: string,
    model: string,
    messages: readonly AiChatMessage[],
  ): Promise<string>;
}
