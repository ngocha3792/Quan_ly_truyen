import { Injectable } from '@nestjs/common';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  RemoveSecurityQuestionsInput,
  RemoveSecurityQuestionsPersistenceResult,
  SecurityQuestionCatalogRecord,
  SecurityQuestionsCredentialRecord,
  SecurityQuestionsPersistencePort,
  SecurityQuestionsStateRecord,
  UpdateSecurityQuestionsInput,
  UpdateSecurityQuestionsPersistenceResult,
} from '../../../../application/ports';

import { AuthAuditAction } from '../../../../domain/enums';

import { PrismaAuthAuditWriterAdapter } from '../../../audit';

@Injectable()
export class PrismaSecurityQuestionsPersistence implements SecurityQuestionsPersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditWriter: PrismaAuthAuditWriterAdapter,
  ) {}

  async findCredentialByUserId(
    userId: string,
  ): Promise<SecurityQuestionsCredentialRecord | null> {
    try {
      return await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          passwordHash: true,
        },
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-security-questions-find-credential',

        resource: 'Câu hỏi bảo mật',
      });
    }
  }

  async findCatalog(
    locale: string,
  ): Promise<readonly SecurityQuestionCatalogRecord[]> {
    try {
      return await this.prisma.securityQuestion.findMany({
        where: {
          locale,

          isActive: true,
        },

        orderBy: [
          {
            sortOrder: 'asc',
          },

          {
            label: 'asc',
          },
        ],

        select: {
          id: true,

          label: true,
        },
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-security-question-catalog',

        resource: 'Danh mục câu hỏi bảo mật',
      });
    }
  }

  async findStateByUserId(
    userId: string,
  ): Promise<SecurityQuestionsStateRecord | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          securityQuestions: {
            orderBy: {
              position: 'asc',
            },

            select: {
              id: true,

              questionId: true,

              updatedAt: true,

              question: {
                select: {
                  label: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      return {
        questions: user.securityQuestions.map((item) => ({
          id: item.id,

          questionId: item.questionId,

          label: item.question.label,

          updatedAt: item.updatedAt,
        })),
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-security-questions-state',

        resource: 'Câu hỏi bảo mật',
      });
    }
  }

  async update(
    input: UpdateSecurityQuestionsInput,
  ): Promise<UpdateSecurityQuestionsPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * Sensitive action:
         * current session phải còn active.
         */
        const currentSession = await tx.session.findFirst({
          where: {
            id: input.currentSessionId,

            userId: input.userId,

            revokedAt: null,

            expiresAt: {
              gt: input.updatedAt,
            },
          },

          select: {
            id: true,
          },
        });

        if (!currentSession) {
          return {
            status: 'current_session_unavailable',
          };
        }

        /*
         * Compare-and-swap passwordHash.
         */
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,

            deletedAt: null,

            passwordHash: input.expectedPasswordHash,
          },

          select: {
            id: true,
          },
        });

        if (!user) {
          return {
            status: 'conflict',
          };
        }

        const questionIds = input.answers.map((answer) => answer.questionId);

        /*
         * Question phải:
         * - tồn tại
         * - active
         * - đúng locale frontend dùng
         */
        const validQuestions = await tx.securityQuestion.findMany({
          where: {
            id: {
              in: questionIds,
            },

            locale: input.locale,

            isActive: true,
          },

          select: {
            id: true,
          },
        });

        if (validQuestions.length !== input.answers.length) {
          return {
            status: 'invalid_questions',
          };
        }

        /*
         * Replace atomically.
         *
         * Nếu createMany fail thì transaction
         * rollback và bộ câu hỏi cũ vẫn còn.
         */
        await tx.userSecurityQuestion.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await tx.userSecurityQuestion.createMany({
          data: input.answers.map((answer) => ({
            userId: input.userId,

            questionId: answer.questionId,

            answerHash: answer.answerHash,

            position: answer.position,
          })),
        });

        const created = await tx.userSecurityQuestion.findMany({
          where: {
            userId: input.userId,
          },

          orderBy: {
            position: 'asc',
          },

          select: {
            id: true,

            questionId: true,

            updatedAt: true,

            question: {
              select: {
                label: true,
              },
            },
          },
        });

        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.currentSessionId,

            action: AuthAuditAction.SECURITY_QUESTIONS_UPDATED,

            entityType: 'user_security_questions',

            entityId: input.userId,

            newValues: {
              configured: true,

              questionIds,

              questionCount: input.answers.length,

              updatedAt: input.updatedAt,
            },
          },
        );

        return {
          status: 'updated',

          value: {
            questions: created.map((item) => ({
              id: item.id,

              questionId: item.questionId,

              label: item.question.label,

              updatedAt: item.updatedAt,
            })),
          },
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-security-questions-update',

        resource: 'Câu hỏi bảo mật',
      });
    }
  }

  async remove(
    input: RemoveSecurityQuestionsInput,
  ): Promise<RemoveSecurityQuestionsPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentSession = await tx.session.findFirst({
          where: {
            id: input.currentSessionId,

            userId: input.userId,

            revokedAt: null,

            expiresAt: {
              gt: input.removedAt,
            },
          },

          select: {
            id: true,
          },
        });

        if (!currentSession) {
          return {
            status: 'current_session_unavailable',
          };
        }

        const user = await tx.user.findFirst({
          where: {
            id: input.userId,

            deletedAt: null,

            passwordHash: input.expectedPasswordHash,
          },

          select: {
            id: true,
          },
        });

        if (!user) {
          return {
            status: 'conflict',
          };
        }

        const removed = await tx.userSecurityQuestion.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.currentSessionId,

            action: AuthAuditAction.SECURITY_QUESTIONS_REMOVED,

            entityType: 'user_security_questions',

            entityId: input.userId,

            oldValues: {
              questionCount: removed.count,
            },

            newValues: {
              configured: false,

              removedAt: input.removedAt,
            },
          },
        );

        return {
          status: 'removed',

          value: {
            questions: [],
          },
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-security-questions-remove',

        resource: 'Câu hỏi bảo mật',
      });
    }
  }
}
