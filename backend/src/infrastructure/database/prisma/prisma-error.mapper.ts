import { Prisma } from '@/generated/prisma/client';
import {
  ConcurrencyConflictException,
  DatabaseException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export function mapPrismaError(
  error: unknown,
  context: {
    operation: string;
    resource?: string;
  },
): Error {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return new DatabaseException({
      operation: context.operation,
      cause: error,
    });
  }

  switch (error.code) {
    case 'P2002':
      return new ResourceConflictException({
        message: `${context.resource ?? 'Tài nguyên'} đã tồn tại`,
        cause: error,
      });

    case 'P2025':
      return new ResourceNotFoundException({
        resource: context.resource ?? 'resource',
      });

    case 'P2034':
      return new ConcurrencyConflictException({
        cause: error,
      });

    default:
      return new DatabaseException({
        operation: context.operation,
        details: {
          prismaCode: error.code,
        },
        cause: error,
      });
  }
}
