/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';

import {
  IdempotencyConflictException,
  InvalidInputException,
} from '@/common/exceptions';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let mockReflector: jest.Mocked<Reflector>;
  let mockIdempotencyStore: any;
  let mockExecutionContext: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockIdempotencyStore = {
      acquire: jest.fn(),
      saveResult: jest.fn(),
      markFailed: jest.fn(),
    };

    interceptor = new IdempotencyInterceptor(
      mockReflector,
      mockIdempotencyStore,
    );

    mockRequest = {
      headers: {},
      path: '/api/v1/orders',
      method: 'POST',
      body: { amount: 100 },
    };

    mockResponse = {
      statusCode: 201,
      status: jest.fn(),
      setHeader: jest.fn(),
    };

    mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
  });

  it('passes through if no @Idempotent() metadata', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const next = { handle: jest.fn().mockReturnValue(of('result')) };
    const observable = await interceptor.intercept(mockExecutionContext, next);

    observable.subscribe((res) => {
      expect(res).toBe('result');
    });
    expect(next.handle).toHaveBeenCalled();
  });

  it('throws InvalidInputException if required header is missing', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ required: true });

    const next = { handle: jest.fn() };

    await expect(
      interceptor.intercept(mockExecutionContext, next),
    ).rejects.toThrow(InvalidInputException);
  });

  it('replays cached response when request is completed and hash matches', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({
      required: true,
      ttlSeconds: 300,
    });
    mockRequest.headers['x-idempotency-key'] = 'key-123';

    const next = { handle: jest.fn() };
    mockIdempotencyStore.acquire.mockImplementation(
      (_k: string, hash: string) => {
        return Promise.resolve({
          acquired: false,
          existingRecord: {
            key: 'key-123',
            requestHash: hash,
            state: 'COMPLETED',
            statusCode: 201,
            responseBody: { success: true },
          },
        });
      },
    );

    const observable = await interceptor.intercept(mockExecutionContext, next);

    observable.subscribe((res) => {
      expect(res).toEqual({ success: true });
    });

    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'x-idempotent-replayed',
      'true',
    );
  });

  it('throws IdempotencyConflictException when request is in PROCESSING state', async () => {
    mockReflector.getAllAndOverride.mockReturnValue({ required: true });
    mockRequest.headers['x-idempotency-key'] = 'key-456';

    mockIdempotencyStore.acquire.mockResolvedValue({
      acquired: false,
      existingRecord: {
        state: 'PROCESSING',
      },
    });

    const next = { handle: jest.fn() };

    await expect(
      interceptor.intercept(mockExecutionContext, next),
    ).rejects.toThrow(IdempotencyConflictException);
  });
});
