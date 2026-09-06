import {
  AI_APPROXIMATE_CHARACTERS_PER_TOKEN,
  AI_MAX_INPUT_TOKENS,
} from '../constants/ai-generation.constants';
import type { AiMessage } from '../ports/ai-protocol-adapter.port';

export function estimateAiTokens(value: string): number {
  return value.length === 0
    ? 0
    : Math.max(
        1,
        Math.ceil(value.length / AI_APPROXIMATE_CHARACTERS_PER_TOKEN),
      );
}

export function fitMessagesToInputTokenBudget(
  systemPrompt: string,
  messages: readonly AiMessage[],
  maxInputTokens = AI_MAX_INPUT_TOKENS,
): readonly AiMessage[] {
  let remainingTokens = Math.max(
    0,
    maxInputTokens - estimateAiTokens(systemPrompt),
  );
  const selected: AiMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const tokens = estimateAiTokens(message.content);
    if (tokens > remainingTokens) break;
    selected.unshift(message);
    remainingTokens -= tokens;
  }

  return selected;
}
