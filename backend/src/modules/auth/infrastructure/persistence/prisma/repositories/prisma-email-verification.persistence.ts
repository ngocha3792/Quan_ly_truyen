import { Injectable } from '@nestjs/common';

import { TokenType } from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ConsumeEmailVerificationTokenInput,
  ConsumeEmailVerificationTokenResult,
  EmailVerificationPersistencePort,
} from '../../../../application/ports';

@Injectable()
export class PrismaEmailVerificationPersistence implements EmailVerificationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async consume(
    input: ConsumeEmailVerificationTokenInput,
  ): Promise<ConsumeEmailVerificationTokenResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const token = await tx.userToken.findUnique({
          where: {
            tokenHash: input.tokenHash,
          },

          select: {
            id: true,
            userId: true,
            type: true,
            expiresAt: true,
            consumedAt: true,

            user: {
              select: {
                id: true,
                email: true,
                emailVerifiedAt: true,
                deletedAt: true,
              },
            },
          },
        });

        if (
          !token ||
          token.type !== TokenType.EMAIL_VERIFICATION ||
          token.user.deletedAt !== null
        ) {
          return {
            status: 'invalid',
          };
        }

        /*
         * Email đã được xác minh trước đó.
         *
         * Trường hợp này được xem là thành công idempotent,
         * miễn là token tồn tại và thuộc đúng user.
         */
        if (token.user.emailVerifiedAt) {
          await this.consumeRemainingTokens(
            tx,
            token.userId,
            token.user.emailVerifiedAt,
          );

          return {
            status: 'already_verified',
            userId: token.user.id,
            email: token.user.email,
            verifiedAt: token.user.emailVerifiedAt,
          };
        }

        if (token.expiresAt <= input.verifiedAt) {
          return {
            status: 'expired',
            expiresAt: token.expiresAt,
          };
        }

        /*
         * Token đã consumed nhưng user chưa verified là trạng thái
         * không hợp lệ. Trong luồng bình thường điều này không xảy ra
         * vì hai thao tác nằm trong cùng một transaction.
         */
        if (token.consumedAt !== null) {
          return {
            status: 'invalid',
          };
        }

        /*
         * Compare-and-swap để chỉ một request có thể claim token.
         */
        const claimedToken = await tx.userToken.updateMany({
          where: {
            id: token.id,
            type: TokenType.EMAIL_VERIFICATION,
            consumedAt: null,
            expiresAt: {
              gt: input.verifiedAt,
            },
          },

          data: {
            consumedAt: input.verifiedAt,
          },
        });

        if (claimedToken.count !== 1) {
          return this.resolveConcurrentResult(
            tx,
            token.id,
            token.userId,
            input.verifiedAt,
          );
        }

        const updatedUser = await tx.user.updateMany({
          where: {
            id: token.userId,
            deletedAt: null,
            emailVerifiedAt: null,
          },

          data: {
            emailVerifiedAt: input.verifiedAt,
          },
        });

        if (updatedUser.count !== 1) {
          return this.resolveConcurrentResult(
            tx,
            token.id,
            token.userId,
            input.verifiedAt,
          );
        }

        /*
         * Token verification khác của user không còn cần thiết.
         * Việc consume chúng cũng ngăn token cũ được dùng lại.
         */
        await this.consumeRemainingTokens(tx, token.userId, input.verifiedAt);

        return {
          status: 'verified',
          userId: token.user.id,
          email: token.user.email,
          verifiedAt: input.verifiedAt,
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-verify-email-token',
        resource: 'Xác minh email',
      });
    }
  }

  private async resolveConcurrentResult(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    tokenId: string,
    userId: string,
    now: Date,
  ): Promise<ConsumeEmailVerificationTokenResult> {
    const [freshUser, freshToken] = await Promise.all([
      tx.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          deletedAt: true,
        },
      }),

      tx.userToken.findUnique({
        where: {
          id: tokenId,
        },

        select: {
          expiresAt: true,
          consumedAt: true,
        },
      }),
    ]);

    if (
      freshUser &&
      freshUser.deletedAt === null &&
      freshUser.emailVerifiedAt
    ) {
      return {
        status: 'already_verified',
        userId: freshUser.id,
        email: freshUser.email,
        verifiedAt: freshUser.emailVerifiedAt,
      };
    }

    if (freshToken && freshToken.expiresAt <= now) {
      return {
        status: 'expired',
        expiresAt: freshToken.expiresAt,
      };
    }

    return {
      status: 'invalid',
    };
  }

  private async consumeRemainingTokens(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    consumedAt: Date,
  ): Promise<void> {
    await tx.userToken.updateMany({
      where: {
        userId,
        type: TokenType.EMAIL_VERIFICATION,
        consumedAt: null,
      },

      data: {
        consumedAt,
      },
    });
  }
}
