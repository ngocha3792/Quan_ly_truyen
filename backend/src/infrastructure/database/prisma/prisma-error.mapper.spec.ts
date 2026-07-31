import { Prisma } from '@/generated/prisma/client';
import {
  ConcurrencyConflictException,
  DatabaseException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

import { mapPrismaError } from './prisma-error.mapper';

describe('mapPrismaError', () => {
  const context = { operation: 'test_operation', resource: 'User' };

  it('maps P2002 error to ResourceConflictException', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.9.1',
      },
    );

    const result = mapPrismaError(error, context);
    expect(result).toBeInstanceOf(ResourceConflictException);
    expect(result.message).toBe('User đã tồn tại');
  });

  it('maps P2025 error to ResourceNotFoundException', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.9.1',
    });

    const result = mapPrismaError(error, context);
    expect(result).toBeInstanceOf(ResourceNotFoundException);
  });

  it('maps P2034 error to ConcurrencyConflictException', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to conflict',
      {
        code: 'P2034',
        clientVersion: '7.9.1',
      },
    );

    const result = mapPrismaError(error, context);
    expect(result).toBeInstanceOf(ConcurrencyConflictException);
  });

  it('maps unknown Prisma code error to DatabaseException', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unknown code', {
      code: 'P9999',
      clientVersion: '7.9.1',
    });

    const result = mapPrismaError(error, context);
    expect(result).toBeInstanceOf(DatabaseException);
  });

  it('maps generic error to DatabaseException', () => {
    const error = new Error('Generic error');

    const result = mapPrismaError(error, context);
    expect(result).toBeInstanceOf(DatabaseException);
  });
});
