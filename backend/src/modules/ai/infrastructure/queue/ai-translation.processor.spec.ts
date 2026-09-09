import { UnrecoverableError } from 'bullmq';

import {
  BusinessRuleViolationException,
  RateLimitExceededException,
} from '@/common/exceptions';
import { AiAuthType, AiProtocol } from '../../domain/enums';
import {
  AUTO_TRANSLATE_CHAPTER_PUBLISHED_EVENT,
  TRANSLATE_CHAPTER_JOB,
} from '@/infrastructure/queue/contracts';

import { AiTranslationProcessor } from './ai-translation.processor';
import { computeChapterTranslationHash } from '../../application/chapter-translation/chapter-translation-hash.util';
import { AI_MAX_OUTPUT_TOKENS } from '../../application/constants/ai-generation.constants';
import { AiRateLimiter } from '../../application/policy/ai-rate-limiter';
import { AiGatewayService } from '../gateway/ai-gateway.service';

const TRANSLATION_ID = '55555555-5555-4555-8555-555555555555';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';
const CONNECTION_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const JOB_DATA = {
  version: 1 as const,
  translationId: TRANSLATION_ID,
  chapterId: CHAPTER_ID,
  targetLanguageCode: 'en',
};

function fakeJob(overrides: Partial<{ name: string; data: unknown }> = {}) {
  return {
    name: TRANSLATE_CHAPTER_JOB,
    data: JOB_DATA,
    ...overrides,
  } as never;
}

describe('AiTranslationProcessor', () => {
  let translations: {
    findById: jest.Mock;
    findChapterSource: jest.Mock;
    markProcessing: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
  };
  let resolver: { resolvePlan: jest.Mock };
  let profiles: { resolve: jest.Mock };
  let requestTranslation: { execute: jest.Mock };
  let gateway: { generate: jest.Mock };
  let resolvedConnections: { fromRecord: jest.Mock };
  let processor: AiTranslationProcessor;

  beforeEach(() => {
    translations = {
      findById: jest.fn().mockResolvedValue({
        id: TRANSLATION_ID,
        chapterId: CHAPTER_ID,
        targetLanguageCode: 'en',
        generation: 1,
        sourceContentHash: computeChapterTranslationHash({
          title: 'Chương 1',
          content: 'Nội dung',
          targetLanguageCode: 'en',
        }),
        status: 'PENDING',
        connectionId: CONNECTION_ID,
        requestedById: USER_ID,
      }),
      findChapterSource: jest.fn().mockResolvedValue({
        storyId: '22222222-2222-4222-8222-222222222222',
        title: 'Chương 1',
        content: 'Nội dung',
      }),
      markProcessing: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    resolver = {
      resolvePlan: jest.fn().mockResolvedValue({
        primary: {
          id: CONNECTION_ID,
          vendorHint: 'openai',
          protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
          authType: AiAuthType.BEARER,
          authHeaderName: null,
          encryptedCredential: 'enc',
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-4o-mini',
        },
        systemFallback: null,
        fallbackPolicy: 'NONE',
      }),
    };
    profiles = {
      resolve: jest.fn().mockResolvedValue({
        model: null,
        systemPrompt: null,
        defaultTranslationLanguageCode: 'en',
        autoTranslateOnPublish: false,
      }),
    };
    requestTranslation = { execute: jest.fn() };
    gateway = {
      generate: jest
        .fn()
        .mockResolvedValueOnce({ content: 'Chapter 1' })
        .mockResolvedValueOnce({ content: 'Content' }),
    };
    resolvedConnections = {
      fromRecord: jest.fn().mockResolvedValue({
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        vendorHint: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        authType: AiAuthType.BEARER,
        authHeaderName: null,
        credential: 'plain-api-key',
        model: 'gpt-4o-mini',
      }),
    };

    processor = new AiTranslationProcessor(
      translations as never,
      resolver as never,
      profiles as never,
      requestTranslation as never,
      gateway as never,
      resolvedConnections as never,
    );
  });

  it('ném UnrecoverableError khi job name/payload không hợp lệ', async () => {
    await expect(
      processor.process(fakeJob({ name: 'unknown.job' })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('auto-translate outbox chỉ tạo request khi profile bật rõ ràng', async () => {
    profiles.resolve.mockResolvedValue({
      model: null,
      systemPrompt: null,
      defaultTranslationLanguageCode: 'ja',
      autoTranslateOnPublish: true,
    });

    await processor.process({
      name: AUTO_TRANSLATE_CHAPTER_PUBLISHED_EVENT,
      data: {
        payload: {
          version: 1,
          userId: USER_ID,
          storyId: '22222222-2222-4222-8222-222222222222',
          chapterId: CHAPTER_ID,
        },
      },
    } as never);

    expect(requestTranslation.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        chapterId: CHAPTER_ID,
        targetLanguageCode: 'ja',
      }),
    );
  });

  it('auto-translate outbox no-op khi profile tắt', async () => {
    await processor.process({
      name: AUTO_TRANSLATE_CHAPTER_PUBLISHED_EVENT,
      data: {
        payload: {
          version: 1,
          userId: USER_ID,
          storyId: '22222222-2222-4222-8222-222222222222',
          chapterId: CHAPTER_ID,
        },
      },
    } as never);

    expect(requestTranslation.execute).not.toHaveBeenCalled();
  });

  it('bỏ qua (no-op) khi không tìm thấy dòng translation', async () => {
    translations.findById.mockResolvedValue(null);

    await expect(processor.process(fakeJob())).resolves.toBeUndefined();
    expect(translations.markProcessing).not.toHaveBeenCalled();
  });

  it('bỏ qua khi translation đã COMPLETED', async () => {
    translations.findById.mockResolvedValue({
      id: TRANSLATION_ID,
      status: 'COMPLETED',
      connectionId: CONNECTION_ID,
    });

    await expect(processor.process(fakeJob())).resolves.toBeUndefined();
    expect(translations.markProcessing).not.toHaveBeenCalled();
  });

  it('does not call providers for superseded jobs or when another worker owns the lease', async () => {
    await processor.process(fakeJob({ data: { ...JOB_DATA, generation: 9 } }));
    translations.markProcessing.mockResolvedValue(false);
    await processor.process(fakeJob());
    expect(gateway.generate).not.toHaveBeenCalled();
  });

  it('rejects stale source and revoked contributor access at worker execution', async () => {
    translations.findChapterSource.mockResolvedValueOnce(null);
    await expect(processor.process(fakeJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(gateway.generate).not.toHaveBeenCalled();
    translations.findChapterSource.mockResolvedValue({
      storyId: 'story',
      title: 'New',
      content: 'Changed source',
    });
    await expect(processor.process(fakeJob())).rejects.toThrow(
      'TRANSLATION_SOURCE_CHANGED',
    );
    expect(gateway.generate).not.toHaveBeenCalled();
  });

  it('does not publish a result when the source changes during generation', async () => {
    translations.findChapterSource
      .mockResolvedValueOnce({
        storyId: 'story',
        title: 'Chương 1',
        content: 'Nội dung',
      })
      .mockResolvedValueOnce({
        storyId: 'story',
        title: 'Chương 1',
        content: 'Nội dung mới',
      });
    await expect(processor.process(fakeJob())).rejects.toThrow(
      'TRANSLATION_SOURCE_CHANGED',
    );
    expect(translations.markCompleted).not.toHaveBeenCalled();
  });

  it('ném UnrecoverableError khi thiếu connectionId', async () => {
    translations.findById.mockResolvedValue({
      id: TRANSLATION_ID,
      status: 'PENDING',
      connectionId: null,
      chapterId: CHAPTER_ID,
      targetLanguageCode: 'en',
    });

    await expect(processor.process(fakeJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('ném UnrecoverableError khi không tìm thấy chapter', async () => {
    translations.findChapterSource.mockResolvedValue(null);

    await expect(processor.process(fakeJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('ném UnrecoverableError khi không tìm thấy connection', async () => {
    resolver.resolvePlan.mockResolvedValue(null);

    await expect(processor.process(fakeJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('dịch thành công: gọi generate 2 lần và markCompleted với kết quả', async () => {
    await processor.process(fakeJob());

    expect(translations.markProcessing).toHaveBeenCalledWith(
      TRANSLATION_ID,
      1,
      expect.any(String),
    );
    expect(gateway.generate).toHaveBeenCalledTimes(2);
    expect(gateway.generate).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ maxOutputTokens: AI_MAX_OUTPUT_TOKENS }),
      expect.any(Object),
      'TRANSLATE',
      null,
    );
    expect(gateway.generate).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Chương 1' }],
      }),
      expect.any(Object),
      'TRANSLATE',
      null,
    );
    expect(translations.markCompleted).toHaveBeenCalledWith({
      translationId: TRANSLATION_ID,
      generation: 1,
      leaseToken: expect.any(String) as unknown,
      translatedTitle: 'Chapter 1',
      translatedContent: 'Content',
    });
  });

  it('passes real gateway token validation for both title and body calls', async () => {
    const buckets = {
      reserve: jest.fn().mockResolvedValue({ allowed: true }),
      reconcileTokens: jest.fn(),
    };
    const limiter = new AiRateLimiter(
      { findByUserId: jest.fn().mockResolvedValue(null) } as never,
      buckets,
    );
    const provider = {
      generate: jest.fn().mockResolvedValue({
        content: 'Translated text',
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        model: 'model',
        latencyMs: 1,
        usage: { inputTokens: 20, outputTokens: 10 },
      }),
    };
    const realGateway = new AiGatewayService(
      { getAdapter: jest.fn().mockReturnValue(provider) } as never,
      { record: jest.fn() },
      limiter,
    );
    const realProcessor = new AiTranslationProcessor(
      translations as never,
      resolver as never,
      profiles as never,
      requestTranslation as never,
      realGateway,
      resolvedConnections as never,
    );
    await realProcessor.process(fakeJob());
    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(buckets.reserve).toHaveBeenCalledTimes(2);
    expect(translations.markCompleted).toHaveBeenCalled();
  });

  it('lỗi retryable (AppException.retryable=true): markFailed rồi rethrow để BullMQ tự retry', async () => {
    const error = new RateLimitExceededException({});
    gateway.generate.mockReset().mockRejectedValue(error);

    await expect(processor.process(fakeJob())).rejects.toThrow(error.code);
    expect(translations.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ translationId: TRANSLATION_ID }),
    );
  });

  it('lỗi không retryable (AppException.retryable=false): markFailed rồi ném UnrecoverableError', async () => {
    const error = new BusinessRuleViolationException({
      message: 'API key không hợp lệ',
    });
    gateway.generate.mockReset().mockRejectedValue(error);

    await expect(processor.process(fakeJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(translations.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ translationId: TRANSLATION_ID }),
    );
  });

  it('sanitizes provider error content before returning a retryable queue error', async () => {
    const error = new Error('network blip');
    gateway.generate.mockReset().mockRejectedValue(error);

    await expect(processor.process(fakeJob())).rejects.toThrow(
      'TRANSLATION_FAILED',
    );
    expect(JSON.stringify(translations.markFailed.mock.calls)).not.toContain(
      'network blip',
    );
  });
});
