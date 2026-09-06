import { Provider } from '@angular/core';

import { AiAssistantRepository } from '../domain/ai-assistant.repository';
import { AiAssistantHttpRepository } from './ai-assistant-http.repository';

export function provideAiAssistant(): Provider[] {
  return [
    {
      provide: AiAssistantRepository,
      useClass: AiAssistantHttpRepository,
    },
  ];
}
