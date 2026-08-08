/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';

import {
  IdempotencyConflictException,
  InvalidInputException,
  ServiceUnavailableException,
} from '@/common/exceptions';

import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let store: {
    acquire: jest.Mock;
    saveResult: jest.Mock;
    markFailed: jest.Mock;
  };
  let reflector: jest.Mocked<Reflector>;
  let request: any;
  let response: any;
  let context: any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    store = {
      acquire: jest.fn().mockResolvedValue({
        acquired: true,
        ownerToken: 'owner-a',
      }),
      saveResult: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    request = {
      headers: { 'x-idempotency-key': 'raw-key' },
      path: '/stories',
      baseUrl: '/api/v1',
      route: { path: '/stories' },
      method: 'POST',
      body: { title: 'Story' },
      query: {},
      user: { userId: 'user-1' },
    };
    response = {
      statusCode: 201,
      status: jest.fn(),
      setHeader: jest.fn(),
    };
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    reflector.getAllAndOverride.mockReturnValue({
      required: true,
      ttlSeconds: 300,
    });
  });

  function interceptor(): IdempotencyInterceptor {
    return new IdempotencyInterceptor(
      reflector,
      store,
      {
        recordIdempotency: jest.fn(),
      } as never,
      {
        inSpan: jest.fn(
          (_name: string, _attributes: object, work: () => unknown) => work(),
        ),
      } as never,
      new ConfigService({
        idempotency: {
          processingLeaseTtlSeconds: 120,
        },
      }),
    );
  }

  async function execute(body: unknown = { ok: true }): Promise<unknown> {
    const observable = await interceptor().intercept(context, {
      handle: jest.fn().mockReturnValue(of(body)),
    });
    return lastValueFrom(observable);
  }

  it('passes through when no idempotency metadata is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(execute('result')).resolves.toBe('result');
    expect(store.acquire).not.toHaveBeenCalled();
  });

  it('requires the header and rejects keys over the configured limit', async () => {
    delete request.headers['x-idempotency-key'];
    await expect(execute()).rejects.toBeInstanceOf(InvalidInputException);
    request.headers['x-idempotency-key'] = 'x'.repeat(129);
    await expect(execute()).rejects.toBeInstanceOf(InvalidInputException);
    expect(store.acquire).not.toHaveBeenCalled();
  });

  it('namespaces the same raw key by user', async () => {
    await execute();
    const firstKey = store.acquire.mock.calls[0][0] as string;
    request.user = { userId: 'user-2' };
    await execute();
    const secondKey = store.acquire.mock.calls[1][0] as string;
    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain(':user-1:POST:');
    expect(secondKey).toContain(':user-2:POST:');
  });

  it('namespaces the same user and raw key by endpoint', async () => {
    await execute();
    const firstKey = store.acquire.mock.calls[0][0] as string;
    request.route.path = '/chapters';
    request.path = '/chapters';
    await execute();
    expect(store.acquire.mock.calls[1][0]).not.toBe(firstKey);
  });

  it('hashes the raw key and saves with the acquired owner token', async () => {
    await execute({ created: true });
    const storageKey = store.acquire.mock.calls[0][0] as string;
    expect(storageKey).not.toContain('raw-key');
    expect(store.saveResult).toHaveBeenCalledWith(
      storageKey,
      'owner-a',
      { statusCode: 201, responseBody: { created: true } },
      300,
    );
  });

  it('uses a short processing lease while retaining the endpoint replay TTL', async () => {
    await execute({ created: true });

    expect(store.acquire).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      120,
    );
    expect(store.saveResult).toHaveBeenCalledWith(
      expect.any(String),
      'owner-a',
      expect.any(Object),
      300,
    );
  });

  it('keeps file retry fingerprints stable and detects changed content', async () => {
    request.file = {
      fieldname: 'sample',
      originalname: 'chapter.pdf',
      mimetype: 'application/pdf',
      encoding: '7bit',
      size: 4,
      path: '/tmp/upload-a',
      buffer: Buffer.from('same'),
    };

    await execute();
    const firstHash = store.acquire.mock.calls[0][1] as string;

    request.file = {
      ...request.file,
      path: '/tmp/upload-b',
      buffer: Buffer.from('same'),
    };
    await execute();
    const retryHash = store.acquire.mock.calls[1][1] as string;

    request.file = {
      ...request.file,
      buffer: Buffer.from('else'),
    };
    await execute();
    const changedContentHash = store.acquire.mock.calls[2][1] as string;

    expect(retryHash).toBe(firstHash);
    expect(changedContentHash).not.toBe(firstHash);
  });

  it('replays a completed response with status and headers', async () => {
    store.acquire.mockImplementation((_key: string, requestHash: string) =>
      Promise.resolve({
        acquired: false,
        existingRecord: {
          requestHash,
          state: 'COMPLETED',
          statusCode: 202,
          responseBody: { replayed: true },
          headers: { location: '/stories/1' },
        },
      }),
    );
    await expect(execute()).resolves.toEqual({ replayed: true });
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.setHeader).toHaveBeenCalledWith('location', '/stories/1');
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotent-replayed',
      'true',
    );
  });

  it('rejects processing records and request-hash conflicts', async () => {
    store.acquire.mockResolvedValueOnce({
      acquired: false,
      existingRecord: { state: 'PROCESSING' },
    });
    await expect(execute()).rejects.toBeInstanceOf(
      IdempotencyConflictException,
    );
    store.acquire.mockResolvedValueOnce({
      acquired: false,
      existingRecord: {
        state: 'COMPLETED',
        requestHash: 'different',
        responseBody: {},
      },
    });
    await expect(execute()).rejects.toBeInstanceOf(
      IdempotencyConflictException,
    );
  });

  it('does not execute the handler when a closed store is unavailable', async () => {
    store.acquire.mockRejectedValue(
      new ServiceUnavailableException({ service: 'idempotency' }),
    );
    const next = { handle: jest.fn().mockReturnValue(of({ ok: true })) };
    await expect(interceptor().intercept(context, next)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('saves a successful business result without releasing the lease', async () => {
    await expect(execute({ created: true })).resolves.toEqual({
      created: true,
    });
    expect(store.saveResult).toHaveBeenCalledTimes(1);
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('releases the owned lease only when the business handler fails', async () => {
    const businessError = new Error('business failed');
    const observable = await interceptor().intercept(context, {
      handle: jest.fn().mockReturnValue(throwError(() => businessError)),
    });

    await expect(lastValueFrom(observable)).rejects.toBe(businessError);
    const storageKey = store.acquire.mock.calls[0][0] as string;
    expect(store.markFailed).toHaveBeenCalledWith(storageKey, 'owner-a');
    expect(store.saveResult).not.toHaveBeenCalled();
  });

  it('returns the committed business result when result persistence fails', async () => {
    const persistenceError = new Error('redis unavailable');
    store.saveResult.mockRejectedValue(persistenceError);
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(execute({ committed: true })).resolves.toEqual({
      committed: true,
    });
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'idempotency-result-persist-failed-after-business-success',
        processingLeaseTtlSeconds: 120,
      }),
    );
    errorLog.mockRestore();
  });

  it('keeps the processing lease after a post-commit store failure', async () => {
    store.saveResult.mockRejectedValue(new Error('redis unavailable'));
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    let businessCommits = 0;
    const next = {
      handle: jest.fn().mockImplementation(() => {
        businessCommits += 1;
        return of({ businessCommits });
      }),
    };

    const firstResult$ = await interceptor().intercept(context, next);
    await expect(lastValueFrom(firstResult$)).resolves.toEqual({
      businessCommits: 1,
    });

    store.acquire.mockResolvedValueOnce({
      acquired: false,
      existingRecord: { state: 'PROCESSING' },
    });

    await expect(interceptor().intercept(context, next)).rejects.toBeInstanceOf(
      IdempotencyConflictException,
    );
    expect(businessCommits).toBe(1);
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(store.markFailed).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('preserves the business error when failed-lease cleanup also fails', async () => {
    const businessError = new Error('business failed');
    store.markFailed.mockRejectedValue(new Error('redis unavailable'));
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const observable = await interceptor().intercept(context, {
      handle: jest.fn().mockReturnValue(throwError(() => businessError)),
    });

    await expect(lastValueFrom(observable)).rejects.toBe(businessError);
    expect(store.saveResult).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'idempotency-business-failure-cleanup-failed',
      }),
    );
    warning.mockRestore();
  });

  it('returns the committed result and does not release a newer owner after ownership loss', async () => {
    const ownershipError = new IdempotencyConflictException({
      key: 'hashed-storage-key',
      message: 'Idempotency processing lease is no longer owned',
    });
    store.saveResult.mockRejectedValue(ownershipError);

    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(execute({ committed: true })).resolves.toEqual({
      committed: true,
    });
    expect(store.markFailed).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
