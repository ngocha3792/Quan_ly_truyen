import { REQUEST_TIMEOUT_MS_KEY } from '@/common/constants';

import { AI_STREAM_TIMEOUT_MS } from '../../../application/constants/ai-generation.constants';
import { AiChatController } from './ai-chat.controller';

describe('AiChatController stream timeout', () => {
  it('cho SSE stream chạy tối đa 10 phút', () => {
    const timeout = Reflect.getMetadata(
      REQUEST_TIMEOUT_MS_KEY,
      Reflect.get(AiChatController.prototype, 'streamMessage') as object,
    ) as unknown;

    expect(timeout).toBe(600_000);
    expect(timeout).toBe(AI_STREAM_TIMEOUT_MS);
  });
});
