import { Logger } from '@nestjs/common';

import { AiAuthType, AiErrorCode, AiProtocol } from '../../domain/enums';
import { AiProtocolRequestError } from '../../application/ports/ai-protocol-adapter.port';
import { AiGatewayService } from './ai-gateway.service';

describe('AiGatewayService explicit system fallback', () => {
  const primary = {
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    vendorHint: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    authType: AiAuthType.BEARER,
    authHeaderName: null,
    credential: 'personal-secret',
    model: 'personal-model',
  };
  const system = {
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    vendorHint: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    authType: AiAuthType.BEARER,
    authHeaderName: null,
    credential: 'system-secret',
    model: 'system-model',
  };
  const request = { messages: [{ role: 'user' as const, content: 'hello' }] };
  const usageContext = { userId: 'user-id', connectionId: 'personal-id' };
  let adapter: { generate: jest.Mock };
  let usage: { record: jest.Mock };
  let rateLimits: { reserve: jest.Mock; reconcile: jest.Mock };
  let gateway: AiGatewayService;

  beforeEach(() => {
    adapter = { generate: jest.fn() };
    usage = { record: jest.fn() };
    rateLimits = {
      reserve: jest.fn().mockResolvedValue({ reservation: true }),
      reconcile: jest.fn(),
    };
    gateway = new AiGatewayService(
      { getAdapter: jest.fn().mockReturnValue(adapter) } as never,
      usage,
      rateLimits as never,
    );
  });

  it('không fallback nếu caller không truyền execution plan SYSTEM', async () => {
    adapter.generate.mockRejectedValue(
      new AiProtocolRequestError('quota', 429),
    );

    await expect(
      gateway.generate(primary, request, usageContext),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
    expect(adapter.generate).toHaveBeenCalledTimes(1);
  });

  it('fallback đúng một lần sang system config đã được policy cho phép', async () => {
    adapter.generate
      .mockRejectedValueOnce(new AiProtocolRequestError('quota', 429))
      .mockResolvedValueOnce({
        content: 'ok',
        protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
        model: 'system-model',
        latencyMs: 10,
        usage: { inputTokens: 2, outputTokens: 1 },
      });

    await expect(
      gateway.generate(primary, request, usageContext, 'CHAT', {
        connection: system,
        connectionId: 'system-id',
      }),
    ).resolves.toMatchObject({ content: 'ok' });

    expect(adapter.generate).toHaveBeenNthCalledWith(1, primary, request);
    expect(adapter.generate).toHaveBeenNthCalledWith(2, system, request);
    expect(rateLimits.reserve).toHaveBeenCalledTimes(1);
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'system-id',
        success: true,
      }),
    );
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'personal-id',
        success: false,
        errorCode: AiErrorCode.RATE_LIMITED,
      }),
    );
  });

  it('structured logs không chứa API key, prompt hoặc nội dung message', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const sensitiveRequest = {
      systemPrompt: 'do-not-log-system-prompt',
      messages: [
        { role: 'user' as const, content: 'do-not-log-private-message' },
      ],
    };
    adapter.generate.mockRejectedValueOnce(
      new AiProtocolRequestError('protocol-safe-error', 429),
    );

    await expect(
      gateway.generate(primary, sensitiveRequest, usageContext),
    ).rejects.toBeDefined();

    const serialized = JSON.stringify([...log.mock.calls, ...warn.mock.calls]);
    expect(serialized).toContain('ai.protocol-attempt.completed');
    expect(serialized).not.toContain(primary.credential);
    expect(serialized).not.toContain(sensitiveRequest.systemPrompt);
    expect(serialized).not.toContain(sensitiveRequest.messages[0].content);
    expect(serialized).not.toContain('protocol-safe-error');
  });
});
