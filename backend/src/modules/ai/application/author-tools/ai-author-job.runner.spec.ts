import { Logger } from '@nestjs/common';
import { AiAuthorJobRunner } from './ai-author-job.runner';
import { AiAuthorConnectionResolver } from './ai-author-connection.resolver';
import { AiAuthorPersistencePort } from './ai-author.persistence.port';
import {
  AuthorJobError,
  type AuthorJob,
  type AuthorSource,
} from './ai-author.types';
import { snapshotAuthorSource } from './ai-author-output';
import { AiAuthType, AiProtocol } from '../../domain/enums';
import { AiGatewayService } from '../../infrastructure/gateway/ai-gateway.service';
import { AiProtocolRegistryPort } from '../ports/ai-protocol-registry.port';
import { AiRateLimiter } from '../policy/ai-rate-limiter';

describe('AI author job runner through gateway', () => {
  const source: AuthorSource = {
    storyVersion: 1,
    chapters: [
      {
        id: 'chapter',
        version: 2,
        number: '1',
        title: 'Title',
        content: 'PRIVATE DRAFT',
      },
    ],
  };
  const job = {
    id: 'job',
    userId: 'user',
    storyId: 'story',
    chapterId: 'chapter',
    connectionId: 'connection',
    jobType: 'CHAPTER_SUMMARY',
    status: 'PROCESSING',
    sourceSnapshot: snapshotAuthorSource(source),
    leaseToken: 'fence',
  } as AuthorJob;
  const resolved = {
    protocol: AiProtocol.OPENAI_CHAT_COMPLETIONS,
    model: 'model',
    vendorHint: null,
    baseUrl: 'https://provider.example/v1',
    credential: 'private-key',
    authType: AiAuthType.BEARER,
    authHeaderName: null,
  };
  let persistence: {
    claim: jest.Mock;
    assertAccess: jest.Mock;
    source: jest.Mock;
    complete: jest.Mock;
    fail: jest.Mock;
  };
  let adapter: { generate: jest.Mock };
  let rateLimits: { reserve: jest.Mock; reconcile: jest.Mock };
  let usage: { record: jest.Mock };
  let connections: { execution: jest.Mock };
  let runner: AiAuthorJobRunner;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    persistence = {
      claim: jest.fn().mockResolvedValue(job),
      assertAccess: jest.fn().mockResolvedValue(undefined),
      source: jest.fn().mockResolvedValue(source),
      complete: jest.fn().mockResolvedValue(true),
      fail: jest.fn().mockResolvedValue(undefined),
    };
    adapter = {
      generate: jest.fn().mockResolvedValue({
        content: '{"summary":"Một bản tóm tắt."}',
        protocol: resolved.protocol,
        model: 'model',
        latencyMs: 10,
        usage: { inputTokens: 11, outputTokens: 7 },
      }),
    };
    rateLimits = {
      reserve: jest.fn().mockResolvedValue(null),
      reconcile: jest.fn().mockResolvedValue(undefined),
    };
    usage = { record: jest.fn().mockResolvedValue(undefined) };
    const gateway = new AiGatewayService(
      { getAdapter: () => adapter } as unknown as AiProtocolRegistryPort,
      usage,
      rateLimits as unknown as AiRateLimiter,
    );
    connections = {
      execution: jest
        .fn()
        .mockResolvedValue({ primary: resolved, fallback: null }),
    };
    runner = new AiAuthorJobRunner(
      persistence as unknown as AiAuthorPersistencePort,
      connections as unknown as AiAuthorConnectionResolver,
      gateway,
    );
  });
  afterEach(() => jest.restoreAllMocks());
  it('attributes explicitly enabled fallback to the provider that actually generated the result', async () => {
    connections.execution.mockResolvedValue({
      primary: resolved,
      fallback: {
        connection: {
          ...resolved,
          protocol: AiProtocol.GEMINI_GENERATE_CONTENT,
          model: 'fallback-model',
        },
        connectionId: 'system-connection',
      },
    });
    adapter.generate
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValueOnce({
        content: '{"summary":"Fallback summary"}',
        protocol: AiProtocol.GEMINI_GENERATE_CONTENT,
        model: 'fallback-model',
        latencyMs: 4,
        usage: { inputTokens: 12, outputTokens: 8 },
      });
    await runner.execute('job');
    expect(persistence.complete).toHaveBeenCalledWith(
      job,
      { summary: 'Fallback summary' },
      {
        inputTokens: 12,
        outputTokens: 8,
        protocol: AiProtocol.GEMINI_GENERATE_CONTENT,
        model: 'fallback-model',
        connectionId: 'system-connection',
      },
    );
    expect(usage.record).toHaveBeenCalledTimes(2);
    expect(rateLimits.reserve).toHaveBeenCalledTimes(1);
  });
  it('records provider/model/tokens, reserves rate limits and completes typed summary', async () => {
    await runner.execute('job');
    expect(rateLimits.reserve).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ maxOutputTokens: 4000, timeoutMs: 30_000 }),
    );
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user',
        capability: 'SUMMARY',
        model: 'model',
        inputTokens: 11,
        outputTokens: 7,
      }),
    );
    expect(persistence.complete).toHaveBeenCalledWith(
      job,
      { summary: 'Một bản tóm tắt.' },
      {
        inputTokens: 11,
        outputTokens: 7,
        protocol: resolved.protocol,
        model: 'model',
        connectionId: 'connection',
      },
    );
    expect(persistence.fail).not.toHaveBeenCalled();
  });
  it('does not call a provider again for a duplicate or cancelled job', async () => {
    persistence.claim.mockResolvedValue(null);
    await runner.execute('job');
    expect(adapter.generate).not.toHaveBeenCalled();
  });
  it('rechecks edit rights at execution after a collaborator is revoked', async () => {
    persistence.assertAccess.mockRejectedValue(
      new AuthorJobError('ACCESS_DENIED'),
    );
    await runner.execute('job');
    expect(adapter.generate).not.toHaveBeenCalled();
    expect(persistence.fail).toHaveBeenCalledWith(job, 'ACCESS_DENIED');
  });
  it('rejects a stale snapshot before spending provider tokens', async () => {
    persistence.source.mockResolvedValue({ ...source, storyVersion: 2 });
    await runner.execute('job');
    expect(adapter.generate).not.toHaveBeenCalled();
    expect(persistence.fail).toHaveBeenCalledWith(job, 'SOURCE_CHANGED');
  });
  it('rejects malformed output without creating results', async () => {
    adapter.generate.mockResolvedValue({
      content: '{"summary":false}',
      protocol: resolved.protocol,
      model: 'model',
      latencyMs: 1,
    });
    await runner.execute('job');
    expect(persistence.complete).not.toHaveBeenCalled();
    expect(persistence.fail).toHaveBeenCalledWith(job, 'INVALID_OUTPUT');
  });
  it('never persists or logs upstream exception text or draft content', async () => {
    adapter.generate.mockRejectedValue(
      new Error('PRIVATE DRAFT private-key echoed upstream'),
    );
    await runner.execute('job');
    expect(persistence.fail).toHaveBeenCalledWith(
      job,
      expect.not.stringContaining('PRIVATE'),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /PRIVATE DRAFT|private-key/u,
    );
    expect(adapter.generate).toHaveBeenCalledTimes(1);
  });
  it('discard completion when cancellation wins the persistence fence', async () => {
    persistence.complete.mockResolvedValue(false);
    await runner.execute('job');
    expect(persistence.fail).not.toHaveBeenCalled();
  });
});
