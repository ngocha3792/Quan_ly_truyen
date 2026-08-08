import { Injectable } from '@nestjs/common';

import {
  AuthorApplicationStatus as PrismaAuthorApplicationStatus,
  AuthorVerificationStatus,
  MediaPurpose,
  MediaStatus,
  Prisma,
} from '@/generated/prisma/client';

import { RoleCode } from '@/common/enums';

import { createUniqueSlug, slugify } from '@/common/utils';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import {
  AuthorApplicationAuditAction,
  AuthorApplicationStatus,
} from '../../domain';

import type {
  ApproveAuthorApplicationResult,
  AuthorApplicationPersistencePort,
  AuthorApplicationRecord,
  ListAuthorApplicationsInput,
  ListAuthorApplicationsResult,
  RejectAuthorApplicationInput,
  RejectAuthorApplicationResult,
  ReviewAuthorApplicationInput,
  SaveAuthorApplicationDraftInput,
  SaveAuthorApplicationDraftResult,
  SubmitAuthorApplicationInput,
  SubmitAuthorApplicationResult,
} from '../../application';

const APPLICATION_SELECT = {
  id: true,

  userId: true,

  status: true,

  penName: true,

  fullName: true,

  email: true,

  phone: true,

  portfolioUrl: true,

  primaryGenre: true,

  experience: true,

  introduction: true,

  firstWorkSynopsis: true,

  acceptedTerms: true,

  submittedAt: true,

  reviewedAt: true,

  reviewedById: true,

  rejectionReason: true,

  createdAt: true,

  updatedAt: true,

  sampleMedia: {
    select: {
      id: true,

      originalName: true,

      mimeType: true,

      sizeBytes: true,

      secureUrl: true,

      publicUrl: true,
    },
  },
} satisfies Prisma.AuthorApplicationSelect;

type ApplicationRow = Prisma.AuthorApplicationGetPayload<{
  select: typeof APPLICATION_SELECT;
}>;

@Injectable()
export class PrismaAuthorApplicationPersistence implements AuthorApplicationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<AuthorApplicationRecord | null> {
    try {
      const application = await this.prisma.authorApplication.findUnique({
        where: {
          userId,
        },

        select: APPLICATION_SELECT,
      });

      return application ? this.toRecord(application) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-application-read-own',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  async findById(
    applicationId: string,
  ): Promise<AuthorApplicationRecord | null> {
    try {
      const application = await this.prisma.authorApplication.findUnique({
        where: {
          id: applicationId,
        },

        select: APPLICATION_SELECT,
      });

      return application ? this.toRecord(application) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-application-read',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  async saveDraft(
    input: SaveAuthorApplicationDraftInput,
  ): Promise<SaveAuthorApplicationDraftResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.findFirst({
            where: {
              id: input.userId,

              deletedAt: null,
            },

            select: {
              id: true,

              authorProfile: {
                select: {
                  userId: true,
                },
              },
            },
          });

          if (!user || user.authorProfile) {
            return {
              status: 'already_author',
            };
          }

          const existing = await tx.authorApplication.findUnique({
            where: {
              userId: input.userId,
            },

            select: {
              id: true,
            },
          });

          /*
           * Chưa có application.
           *
           * Dùng create thay vì upsert để nhánh update không thể
           * vô tình ghi lên application đã chuyển PENDING.
           *
           * P2002 do 2 request create đồng thời sẽ được retry
           * ở vòng ngoài.
           */
          if (!existing) {
            const created = await tx.authorApplication.create({
              data: {
                userId: input.userId,

                status: PrismaAuthorApplicationStatus.DRAFT,

                penName: input.penName ?? null,

                fullName: input.fullName ?? null,

                email: input.email ?? null,

                phone: input.phone ?? null,

                portfolioUrl: input.portfolioUrl ?? null,

                primaryGenre: input.primaryGenre ?? null,

                experience: input.experience ?? null,

                introduction: input.introduction ?? null,

                firstWorkSynopsis: input.firstWorkSynopsis ?? null,

                acceptedTerms: input.acceptedTerms ?? false,
              },

              select: APPLICATION_SELECT,
            });

            return {
              status: 'saved',

              application: this.toRecord(created),
            };
          }

          /*
           * Quan trọng:
           *
           * lock row trước khi đọc status lần cuối.
           *
           * Nếu submit() đang chạy:
           * - saveDraft phải đợi.
           * - sau khi submit commit, status sẽ là PENDING.
           * - saveDraft trả về `pending`, không ghi đè nữa.
           *
           * Nếu saveDraft lấy lock trước:
           * - submit phải đợi.
           * - submit sau đó sẽ đọc đúng draft mới nhất.
           */
          await lockAuthorApplicationRow(
            tx,

            existing.id,
          );

          const current = await tx.authorApplication.findUnique({
            where: {
              id: existing.id,
            },

            select: {
              id: true,

              status: true,
            },
          });

          if (!current) {
            throw new Error(
              'Author application disappeared while saving draft',
            );
          }

          if (current.status === PrismaAuthorApplicationStatus.PENDING) {
            return {
              status: 'pending',
            };
          }

          if (current.status === PrismaAuthorApplicationStatus.APPROVED) {
            return {
              status: 'already_author',
            };
          }

          const reopenRejectedApplication =
            current.status === PrismaAuthorApplicationStatus.REJECTED;

          const application = await tx.authorApplication.update({
            where: {
              id: current.id,
            },

            data: {
              ...(input.penName !== undefined
                ? {
                    penName: input.penName,
                  }
                : {}),

              ...(input.fullName !== undefined
                ? {
                    fullName: input.fullName,
                  }
                : {}),

              ...(input.email !== undefined
                ? {
                    email: input.email,
                  }
                : {}),

              ...(input.phone !== undefined
                ? {
                    phone: input.phone,
                  }
                : {}),

              ...(input.portfolioUrl !== undefined
                ? {
                    portfolioUrl: input.portfolioUrl,
                  }
                : {}),

              ...(input.primaryGenre !== undefined
                ? {
                    primaryGenre: input.primaryGenre,
                  }
                : {}),

              ...(input.experience !== undefined
                ? {
                    experience: input.experience,
                  }
                : {}),

              ...(input.introduction !== undefined
                ? {
                    introduction: input.introduction,
                  }
                : {}),

              ...(input.firstWorkSynopsis !== undefined
                ? {
                    firstWorkSynopsis: input.firstWorkSynopsis,
                  }
                : {}),

              ...(input.acceptedTerms !== undefined
                ? {
                    acceptedTerms: input.acceptedTerms,
                  }
                : {}),

              /**
               * REJECTED -> DRAFT là một submission cycle mới.
               *
               * Không được để metadata của lần submit/review trước
               * tiếp tục tồn tại trên state DRAFT hiện hành.
               *
               * sampleMediaId được detach:
               *
               * - sample cũ vẫn là MediaAsset READY
               * - không còn relation AuthorApplicationSample
               * - Phase 6 cleanup sẽ thu gom sau grace period
               */
              ...(reopenRejectedApplication
                ? {
                    status: PrismaAuthorApplicationStatus.DRAFT,

                    sampleMediaId: null,

                    submittedAt: null,

                    reviewedAt: null,

                    reviewedById: null,

                    rejectionReason: null,
                  }
                : {}),
            },

            select: APPLICATION_SELECT,
          });

          return {
            status: 'saved',

            application: this.toRecord(application),
          };
        });
      } catch (error: unknown) {
        /*
         * Hai request save draft đầu tiên có thể cùng thấy
         * chưa tồn tại application.
         *
         * Request thua unique(userId) retry một lần,
         * lần hai sẽ đi vào nhánh lock/update phía trên.
         */
        if (attempt === 0 && isUniqueConstraintViolation(error)) {
          continue;
        }

        throw mapPrismaError(error, {
          operation: 'author-application-save-draft',

          resource: 'Hồ sơ đăng ký tác giả',
        });
      }
    }

    throw new Error('Unable to save author application draft');
  }

  async submit(
    input: SubmitAuthorApplicationInput,
  ): Promise<SubmitAuthorApplicationResult> {
    /*
     * Nếu transaction thua partial unique index,
     * transaction sẽ rollback hoàn toàn.
     *
     * Giữ penName bên ngoài transaction để sau rollback
     * có thể xác minh conflict và map về domain result.
     */
    let attemptedPenName: string | null = null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * Lock application hiện tại trước khi đọc.
         *
         * Điều này bảo vệ race:
         *
         * saveDraft(application A)
         * vs
         * submit(application A)
         *
         * nhưng KHÔNG bảo vệ hai application khác nhau
         * cùng penName.
         *
         * Việc đó giờ do partial unique index xử lý.
         */
        const locked = await lockAuthorApplicationRow(
          tx,

          input.applicationId,
        );

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        const application = await tx.authorApplication.findFirst({
          where: {
            id: input.applicationId,

            userId: input.userId,
          },

          select: APPLICATION_SELECT,
        });

        if (!application) {
          return {
            status: 'not_found',
          };
        }

        if (application.status === PrismaAuthorApplicationStatus.APPROVED) {
          return {
            status: 'already_author',
          };
        }

        /*
         * Submit lại một application đã PENDING
         * vẫn idempotent.
         */
        if (application.status === PrismaAuthorApplicationStatus.PENDING) {
          return {
            status: 'submitted',

            application: this.toRecord(application),
          };
        }

        const missingFields = findMissingFields(application);

        if (missingFields.length > 0) {
          return {
            status: 'incomplete',

            missingFields,
          };
        }

        /*
         * Sample bắt buộc:
         *
         * - đúng id
         * - đúng uploader
         * - đúng purpose
         * - READY
         * - chưa deleted
         * - metadata.ownerId === application.id
         */
        /**
         * Serialize sample attachment với media cleanup.
         *
         * Nếu cleanup claim DELETING trước:
         * -> lock này đợi
         * -> sau đó status không còn READY
         * -> invalid_sample.
         *
         * Nếu submit lock trước:
         * -> cleanup đợi
         * -> application attach sample + commit
         * -> cleanup relation predicate fail
         * -> không delete.
         */
        const sampleLocked = await lockMediaAssetRow(
          tx,

          input.sampleMediaId,
        );

        if (!sampleLocked) {
          return {
            status: 'invalid_sample',
          };
        }

        const sample = await tx.mediaAsset.findFirst({
          where: {
            id: input.sampleMediaId,

            uploaderId: input.userId,

            purpose: MediaPurpose.AUTHOR_APPLICATION_SAMPLE,

            status: MediaStatus.READY,

            deletedAt: null,
          },

          select: {
            id: true,

            metadata: true,
          },
        });

        if (!sample || readMediaOwnerId(sample.metadata) !== application.id) {
          return {
            status: 'invalid_sample',
          };
        }

        /*
         * findMissingFields() đã đảm bảo penName tồn tại.
         */
        const penName = application.penName!;

        /*
         * Lưu ra ngoài transaction để nếu UPDATE bị
         * unique violation thì catch phía ngoài vẫn biết
         * penName nào đang được submit.
         */
        attemptedPenName = penName;

        /*
         * Pre-check vẫn giữ.
         *
         * Nó không phải correctness guarantee,
         * nhưng giúp case bình thường fail sớm
         * trước khi đụng unique constraint.
         */
        const [authorOwner, pendingOwner] = await Promise.all([
          tx.authorProfile.findFirst({
            where: {
              userId: {
                not: input.userId,
              },

              penName: {
                equals: penName,

                mode: 'insensitive',
              },
            },

            select: {
              userId: true,
            },
          }),

          tx.authorApplication.findFirst({
            where: {
              id: {
                not: application.id,
              },

              status: PrismaAuthorApplicationStatus.PENDING,

              penName: {
                equals: penName,

                mode: 'insensitive',
              },
            },

            select: {
              id: true,
            },
          }),
        ]);

        if (authorOwner || pendingOwner) {
          return {
            status: 'pen_name_unavailable',

            penName,
          };
        }

        /*
         * Race quan trọng:
         *
         * Tx A:
         * check Moon => none
         *
         * Tx B:
         * check moon => none
         *
         * Cả hai có thể tới UPDATE này.
         *
         * Partial unique index PostgreSQL:
         *
         * author_applications_pending_pen_name_lower_unique
         *
         * sẽ chỉ cho một transaction commit.
         */
        const updated = await tx.authorApplication.update({
          where: {
            id: application.id,
          },

          data: {
            status: PrismaAuthorApplicationStatus.PENDING,

            sampleMediaId: input.sampleMediaId,

            submittedAt: input.submittedAt,

            reviewedAt: null,

            reviewedById: null,

            rejectionReason: null,
          },

          select: APPLICATION_SELECT,
        });

        /*
         * Audit nằm cùng transaction.
         *
         * Nếu unique constraint fail ở UPDATE phía trên
         * thì audit này không được tạo.
         */
        await tx.auditLog.create({
          data: {
            actorId: input.userId,

            action: AuthorApplicationAuditAction.SUBMITTED,

            entityType: 'author_application',

            entityId: application.id,

            newValues: {
              status: AuthorApplicationStatus.PENDING,

              sampleMediaId: input.sampleMediaId,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,
          },
        });

        return {
          status: 'submitted',

          application: this.toRecord(updated),
        };
      });
    } catch (error: unknown) {
      /*
       * PostgreSQL unique violation aborts transaction.
       *
       * Không được catch P2002 bên trong callback
       * rồi cố tiếp tục transaction, vì PostgreSQL
       * transaction lúc đó đã ở aborted state.
       *
       * Ta xử lý SAU khi Prisma rollback transaction.
       */
      if (attemptedPenName && isUniqueConstraintViolation(error)) {
        const hasPendingOwner = await this.hasConflictingPendingPenName(
          input.applicationId,

          attemptedPenName,
        );

        if (hasPendingOwner) {
          return {
            status: 'pen_name_unavailable',

            penName: attemptedPenName,
          };
        }
      }

      throw mapPrismaError(
        error,

        {
          operation: 'author-application-submit',

          resource: 'Hồ sơ đăng ký tác giả',
        },
      );
    }
  }

  private async hasConflictingPendingPenName(
    applicationId: string,

    penName: string,
  ): Promise<boolean> {
    try {
      const owner = await this.prisma.authorApplication.findFirst({
        where: {
          id: {
            not: applicationId,
          },

          status: PrismaAuthorApplicationStatus.PENDING,

          penName: {
            equals: penName,

            mode: 'insensitive',
          },
        },

        select: {
          id: true,
        },
      });

      return Boolean(owner);
    } catch (error: unknown) {
      throw mapPrismaError(
        error,

        {
          operation: 'author-application-submit-conflict-verification',

          resource: 'Hồ sơ đăng ký tác giả',
        },
      );
    }
  }

  async list(
    input: ListAuthorApplicationsInput,
  ): Promise<ListAuthorApplicationsResult> {
    try {
      const where: Prisma.AuthorApplicationWhereInput = input.status
        ? {
            status: input.status,
          }
        : {};

      const [total, applications] = await Promise.all([
        this.prisma.authorApplication.count({
          where,
        }),

        this.prisma.authorApplication.findMany({
          where,

          orderBy: [
            {
              submittedAt: 'asc',
            },

            {
              createdAt: 'asc',
            },
          ],

          skip: input.offset,

          take: input.limit,

          select: APPLICATION_SELECT,
        }),
      ]);

      return {
        total,

        applications: applications.map((application) =>
          this.toRecord(application),
        ),
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-application-list',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  async approve(
    input: ReviewAuthorApplicationInput,
  ): Promise<ApproveAuthorApplicationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * Đây là điểm giải quyết race approve/reject.
         *
         * Admin thứ hai sẽ block tại đây cho tới khi transaction
         * admin thứ nhất commit/rollback.
         */
        const locked = await lockAuthorApplicationRow(
          tx,

          input.applicationId,
        );

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        /*
         * Đọc lại SAU KHI lấy lock.
         *
         * Không dùng snapshot đã đọc trước lock.
         */
        const application = await tx.authorApplication.findUnique({
          where: {
            id: input.applicationId,
          },

          select: APPLICATION_SELECT,
        });

        if (!application) {
          return {
            status: 'not_found',
          };
        }

        if (application.userId === input.reviewerId) {
          return {
            status: 'self_review',
          };
        }

        /*
         * Nếu một admin khác vừa reject/approve và commit,
         * admin hiện tại sẽ thấy state mới ở đây.
         */
        if (application.status !== PrismaAuthorApplicationStatus.PENDING) {
          return {
            status: 'not_pending',
          };
        }

        const existingProfile = await tx.authorProfile.findUnique({
          where: {
            userId: application.userId,
          },

          select: {
            userId: true,
          },
        });

        if (existingProfile) {
          return {
            status: 'already_author',
          };
        }

        const penName = application.penName!;

        const penNameOwner = await tx.authorProfile.findFirst({
          where: {
            penName: {
              equals: penName,

              mode: 'insensitive',
            },
          },

          select: {
            userId: true,
          },
        });

        if (penNameOwner) {
          return {
            status: 'pen_name_unavailable',

            penName,
          };
        }

        const authorRole = await tx.role.findUnique({
          where: {
            code: RoleCode.AUTHOR,
          },

          select: {
            id: true,
          },
        });

        if (!authorRole) {
          return {
            status: 'role_missing',
          };
        }

        const slug = await createAuthorSlug(
          tx,

          penName,

          application.userId,
        );

        /*
         * Tất cả side effect vẫn trong transaction đang giữ
         * row lock AuthorApplication.
         *
         * Nếu bất kỳ bước nào fail:
         * - authorProfile rollback
         * - userRole rollback
         * - status rollback
         */
        await tx.authorProfile.create({
          data: {
            userId: application.userId,

            penName,

            slug,

            biography: application.introduction,

            websiteUrl: application.portfolioUrl,

            verificationStatus: AuthorVerificationStatus.VERIFIED,

            verifiedAt: input.reviewedAt,
          },
        });

        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: application.userId,

              roleId: authorRole.id,
            },
          },

          create: {
            userId: application.userId,

            roleId: authorRole.id,

            assignedById: input.reviewerId,

            assignedAt: input.reviewedAt,
          },

          update: {
            assignedById: input.reviewerId,

            assignedAt: input.reviewedAt,

            expiresAt: null,
          },
        });

        const updated = await tx.authorApplication.update({
          where: {
            id: application.id,
          },

          data: {
            status: PrismaAuthorApplicationStatus.APPROVED,

            reviewedAt: input.reviewedAt,

            reviewedById: input.reviewerId,

            rejectionReason: null,
          },

          select: APPLICATION_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.reviewerId,

            action: AuthorApplicationAuditAction.APPROVED,

            entityType: 'author_application',

            entityId: application.id,

            oldValues: {
              status: AuthorApplicationStatus.PENDING,
            },

            newValues: {
              status: AuthorApplicationStatus.APPROVED,

              authorUserId: application.userId,

              role: RoleCode.AUTHOR,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,
          },
        });

        return {
          status: 'approved',

          application: this.toRecord(updated),

          userId: application.userId,
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-application-approve',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  async reject(
    input: RejectAuthorApplicationInput,
  ): Promise<RejectAuthorApplicationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await lockAuthorApplicationRow(
          tx,

          input.applicationId,
        );

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        /*
         * Phải đọc lại sau FOR UPDATE.
         *
         * Nếu approve đã thắng trước đó:
         * status lúc này là APPROVED
         * → trả not_pending
         * → tuyệt đối không REJECT đè lên.
         */
        const application = await tx.authorApplication.findUnique({
          where: {
            id: input.applicationId,
          },

          select: APPLICATION_SELECT,
        });

        if (!application) {
          return {
            status: 'not_found',
          };
        }

        if (application.userId === input.reviewerId) {
          return {
            status: 'self_review',
          };
        }

        if (application.status !== PrismaAuthorApplicationStatus.PENDING) {
          return {
            status: 'not_pending',
          };
        }

        const updated = await tx.authorApplication.update({
          where: {
            id: application.id,
          },

          data: {
            status: PrismaAuthorApplicationStatus.REJECTED,

            reviewedAt: input.reviewedAt,

            reviewedById: input.reviewerId,

            rejectionReason: input.reason,
          },

          select: APPLICATION_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.reviewerId,

            action: AuthorApplicationAuditAction.REJECTED,

            entityType: 'author_application',

            entityId: application.id,

            oldValues: {
              status: AuthorApplicationStatus.PENDING,
            },

            newValues: {
              status: AuthorApplicationStatus.REJECTED,
            },

            metadata: {
              reason: input.reason,
            },

            ipAddress: input.audit.ipAddress,

            userAgent: input.audit.userAgent,

            requestId: input.audit.requestId,
          },
        });

        return {
          status: 'rejected',

          application: this.toRecord(updated),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-application-reject',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  private toRecord(application: ApplicationRow): AuthorApplicationRecord {
    return {
      id: application.id,

      userId: application.userId,

      status: application.status as AuthorApplicationStatus,

      penName: application.penName,

      fullName: application.fullName,

      email: application.email,

      phone: application.phone,

      portfolioUrl: application.portfolioUrl,

      primaryGenre: application.primaryGenre,

      experience: application.experience,

      introduction: application.introduction,

      firstWorkSynopsis: application.firstWorkSynopsis,

      acceptedTerms: application.acceptedTerms,

      sample: application.sampleMedia
        ? {
            id: application.sampleMedia.id,

            fileName: application.sampleMedia.originalName,

            mimeType: application.sampleMedia.mimeType,

            sizeBytes: application.sampleMedia.sizeBytes,

            url:
              application.sampleMedia.secureUrl ??
              application.sampleMedia.publicUrl,
          }
        : null,

      submittedAt: application.submittedAt,

      reviewedAt: application.reviewedAt,

      reviewedById: application.reviewedById,

      rejectionReason: application.rejectionReason,

      createdAt: application.createdAt,

      updatedAt: application.updatedAt,
    };
  }
}

async function lockAuthorApplicationRow(
  tx: Prisma.TransactionClient,

  applicationId: string,
): Promise<boolean> {
  /*
   * PostgreSQL row-level lock.
   *
   * Lock tồn tại cho tới khi transaction commit/rollback.
   *
   * Parameter được Prisma bind nên không có SQL injection.
   */
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "author_applications"
    WHERE "id" = ${applicationId}::uuid
    FOR UPDATE
  `);

  return rows.length === 1;
}

async function lockMediaAssetRow(
  tx: Prisma.TransactionClient,

  mediaAssetId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
    }>
  >(Prisma.sql`
      SELECT "id"
      FROM "media_assets"
      WHERE "id" = ${mediaAssetId}::uuid
      FOR UPDATE
    `);

  return rows.length === 1;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function findMissingFields(application: ApplicationRow): string[] {
  const missing: string[] = [];

  const required: readonly [string, string | null][] = [
    ['penName', application.penName],

    ['fullName', application.fullName],

    ['email', application.email],

    ['phone', application.phone],

    ['primaryGenre', application.primaryGenre],

    ['experience', application.experience],

    ['introduction', application.introduction],

    ['firstWorkSynopsis', application.firstWorkSynopsis],
  ];

  for (const [field, value] of required) {
    if (!value?.trim()) {
      missing.push(field);
    }
  }

  if (!application.acceptedTerms) {
    missing.push('acceptedTerms');
  }

  return missing;
}

function readMediaOwnerId(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)['ownerId'];

  return typeof value === 'string' ? value : null;
}

async function createAuthorSlug(
  tx: Prisma.TransactionClient,

  penName: string,

  userId: string,
): Promise<string> {
  const base =
    slugify(
      penName,

      {
        maxLength: 140,
      },
    ) || `author-${userId.slice(0, 8)}`;

  const existing = await tx.authorProfile.findUnique({
    where: {
      slug: base,
    },

    select: {
      userId: true,
    },
  });

  if (!existing) {
    return base;
  }

  return createUniqueSlug(
    base,

    userId.slice(0, 8),
  ).slice(0, 160);
}
