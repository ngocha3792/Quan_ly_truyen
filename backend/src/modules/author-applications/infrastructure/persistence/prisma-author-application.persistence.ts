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

            status: true,
          },
        });

        if (existing?.status === PrismaAuthorApplicationStatus.PENDING) {
          return {
            status: 'pending',
          };
        }

        if (existing?.status === PrismaAuthorApplicationStatus.APPROVED) {
          return {
            status: 'already_author',
          };
        }

        const resetReview =
          existing?.status === PrismaAuthorApplicationStatus.REJECTED;

        const application = await tx.authorApplication.upsert({
          where: {
            userId: input.userId,
          },

          create: {
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

          update: {
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

            ...(resetReview
              ? {
                  status: PrismaAuthorApplicationStatus.DRAFT,

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
      throw mapPrismaError(error, {
        operation: 'author-application-save-draft',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  async submit(
    input: SubmitAuthorApplicationInput,
  ): Promise<SubmitAuthorApplicationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const sample = await tx.mediaAsset.findFirst({
          where: {
            id: input.sampleMediaId,

            uploaderId: input.userId,

            purpose: MediaPurpose.ATTACHMENT,

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

        const penName = application.penName!;

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
      throw mapPrismaError(error, {
        operation: 'author-application-submit',

        resource: 'Hồ sơ đăng ký tác giả',
      });
    }
  }

  async list(
    input: ListAuthorApplicationsInput,
  ): Promise<ListAuthorApplicationsResult> {
    try {
      const where: Prisma.AuthorApplicationWhereInput = input.status
        ? {
            status: input.status as PrismaAuthorApplicationStatus,
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
