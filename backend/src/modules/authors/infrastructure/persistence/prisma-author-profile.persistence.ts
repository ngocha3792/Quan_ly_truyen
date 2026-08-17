import { Injectable } from '@nestjs/common';
import type { AuthorProfileSocialLinks, AuthorProfileView, UpdateAuthorProfileInput } from '../../application/dto';
import type { AuthorProfilePersistencePort } from '../../application/ports';
import {
  AuthorLifecycleStatus,
  AuthorVerificationStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  Prisma,
} from '@/generated/prisma/client';
import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';

const EDITABLE_SOCIAL_KEYS = [
  'facebook',
  'instagram',
  'x',
  'youtube',
  'tiktok',
] as const;

@Injectable()
export class PrismaAuthorProfilePersistence implements AuthorProfilePersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<AuthorProfileView> {
    const record = await this.prisma.authorProfile.findUnique({
      where: { userId },
      select: {
        userId: true,
        penName: true,
        slug: true,
        biography: true,
        websiteUrl: true,
        socialLinks: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
        bannerMedia: {
          select: {
            id: true,
            secureUrl: true,
            publicUrl: true,
            status: true,
            deletedAt: true,
          },
        },
        user: {
          select: {
            deletedAt: true,
            avatarMedia: {
              select: {
                id: true,
                secureUrl: true,
                publicUrl: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!record || record.user.deletedAt) {
      throw new ResourceNotFoundException({
        code: 'AUTHOR_PROFILE_NOT_FOUND',
        resource: 'hồ sơ tác giả',
        identifier: userId,
      });
    }

    return this.toView(record);
  }

  async update(input: UpdateAuthorProfileInput): Promise<AuthorProfileView> {
    const normalizedName =
      input.displayName === undefined
        ? undefined
        : this.normalizeDisplayName(input.displayName);
    const normalizedBio =
      input.bio === undefined ? undefined : this.normalizeBio(input.bio);
    const normalizedLinks =
      input.socialLinks === undefined
        ? undefined
        : this.normalizeSocialLinks(input.socialLinks);
    const changedAt = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        // Keep lock ordering consistent with account deletion: User -> AuthorProfile.
        await this.lockUser(tx, input.userId);
        await this.lockAuthor(tx, input.userId);
        const current = await tx.authorProfile.findUnique({
          where: { userId: input.userId },
          select: {
            penName: true,
            biography: true,
            lifecycleStatus: true,
            websiteUrl: true,
            socialLinks: true,
            bannerMediaId: true,
            user: {
              select: {
                deletedAt: true,
                avatarMediaId: true,
              },
            },
          },
        });

        if (!current || current.user.deletedAt) {
          throw new ResourceNotFoundException({
            code: 'AUTHOR_PROFILE_NOT_FOUND',
            resource: 'hồ sơ tác giả',
            identifier: input.userId,
          });
        }
        if (current.lifecycleStatus !== AuthorLifecycleStatus.ACTIVE) {
          throw new ResourceConflictException({
            code: 'AUTHOR_PROFILE_NOT_MUTABLE',
            message:
              'Chỉ tác giả đang hoạt động mới có thể cập nhật hồ sơ công khai',
            details: { lifecycleStatus: current.lifecycleStatus },
          });
        }

        if (input.avatarMediaId) {
          await this.assertMedia(
            tx,
            input.avatarMediaId,
            input.userId,
            MediaPurpose.AVATAR,
            'AUTHOR_AVATAR_INVALID',
          );
        }
        if (input.bannerMediaId) {
          await this.assertMedia(
            tx,
            input.bannerMediaId,
            input.userId,
            MediaPurpose.AUTHOR_BANNER,
            'AUTHOR_BANNER_INVALID',
          );
        }

        const currentSocial = this.asJsonRecord(current.socialLinks);
        const nextWebsite =
          normalizedLinks?.website !== undefined
            ? normalizedLinks.website
            : current.websiteUrl;
        const nextSocial =
          normalizedLinks === undefined
            ? currentSocial
            : this.mergeEditableSocialLinks(currentSocial, normalizedLinks);

        if (input.avatarMediaId !== undefined) {
          await tx.user.update({
            where: { id: input.userId },
            data: {
              avatarMediaId: input.avatarMediaId,
              updatedAt: changedAt,
            },
          });
        }

        await tx.authorProfile.update({
          where: { userId: input.userId },
          data: {
            ...(normalizedName !== undefined
              ? { penName: normalizedName }
              : {}),
            ...(normalizedBio !== undefined
              ? { biography: normalizedBio }
              : {}),
            ...(input.bannerMediaId !== undefined
              ? { bannerMediaId: input.bannerMediaId }
              : {}),
            ...(normalizedLinks !== undefined
              ? {
                  websiteUrl: nextWebsite,
                  socialLinks: Object.keys(nextSocial).length
                    ? (nextSocial as Prisma.InputJsonObject)
                    : Prisma.DbNull,
                }
              : {}),
            updatedAt: changedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'author.profile.updated',
            entityType: 'author',
            entityId: input.userId,
            oldValues: this.auditValues({
              displayName: current.penName,
              bioChanged: input.bio !== undefined ? false : undefined,
              avatarMediaId:
                input.avatarMediaId !== undefined
                  ? current.user.avatarMediaId
                  : undefined,
              bannerMediaId:
                input.bannerMediaId !== undefined
                  ? current.bannerMediaId
                  : undefined,
              socialLinks:
                normalizedLinks !== undefined
                  ? this.publicSocialLinks(current.websiteUrl, currentSocial)
                  : undefined,
            }),
            newValues: this.auditValues({
              displayName: normalizedName,
              bioChanged: input.bio !== undefined ? true : undefined,
              avatarMediaId: input.avatarMediaId,
              bannerMediaId: input.bannerMediaId,
              socialLinks:
                normalizedLinks !== undefined
                  ? this.publicSocialLinks(nextWebsite, nextSocial)
                  : undefined,
            }),
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: changedAt,
          },
        });
      });
    } catch (error: unknown) {
      if (this.isPenNameConflict(error)) {
        throw new ResourceConflictException({
          code: 'AUTHOR_DISPLAY_NAME_UNAVAILABLE',
          message: 'Tên tác giả này đã được sử dụng',
          field: 'displayName',
        });
      }
      throw error;
    }

    return this.get(input.userId);
  }

  private async lockUser(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; deleted_at: Date | null }>
    >(Prisma.sql`
      SELECT id, "deleted_at"
      FROM "users"
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `);
    if (rows.length === 0 || rows[0]?.deleted_at) {
      throw new ResourceNotFoundException({
        code: 'AUTHOR_PROFILE_NOT_FOUND',
        resource: 'hồ sơ tác giả',
        identifier: userId,
      });
    }
  }

  private async lockAuthor(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ user_id: string }>>(Prisma.sql`
      SELECT "user_id"
      FROM "author_profiles"
      WHERE "user_id" = ${userId}::uuid
      FOR UPDATE
    `);
    if (rows.length === 0) {
      throw new ResourceNotFoundException({
        code: 'AUTHOR_PROFILE_NOT_FOUND',
        resource: 'hồ sơ tác giả',
        identifier: userId,
      });
    }
  }

  private async assertMedia(
    tx: Prisma.TransactionClient,
    mediaId: string,
    userId: string,
    purpose: MediaPurpose,
    code: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "media_assets" WHERE id = ${mediaId}::uuid FOR UPDATE
    `);
    if (locked.length === 0) {
      throw new InvalidInputException({
        code,
        message: 'Media không hợp lệ cho hồ sơ tác giả',
      });
    }
    const media = await tx.mediaAsset.findFirst({
      where: {
        id: mediaId,
        uploaderId: userId,
        purpose,
        status: MediaStatus.READY,
        resourceType: MediaResourceType.IMAGE,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!media) {
      throw new InvalidInputException({
        code,
        message: 'Media không hợp lệ cho hồ sơ tác giả',
      });
    }
  }

  private normalizeDisplayName(value: string): string {
    const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (
      normalized.length < 2 ||
      normalized.length > 120 ||
      // eslint-disable-next-line no-control-regex -- control characters are explicitly rejected
      /[\u0000-\u001F\u007F]/u.test(normalized)
    ) {
      throw new InvalidInputException({
        code: 'AUTHOR_DISPLAY_NAME_INVALID',
        message:
          'Tên tác giả phải có từ 2 đến 120 ký tự và không chứa ký tự điều khiển',
      });
    }
    return normalized;
  }

  private normalizeBio(value: string | null): string | null {
    if (value === null) return null;
    const normalized = value.normalize('NFC').trim();
    if (!normalized) return null;
    if (normalized.length > 5000) {
      throw new InvalidInputException({
        code: 'AUTHOR_BIO_TOO_LONG',
        message: 'Tiểu sử tối đa 5000 ký tự',
      });
    }
    if (/<\/?[a-z][^>]*>/iu.test(normalized)) {
      throw new InvalidInputException({
        code: 'AUTHOR_BIO_HTML_NOT_ALLOWED',
        message: 'Tiểu sử chỉ hỗ trợ văn bản thuần',
      });
    }
    return normalized;
  }

  private normalizeSocialLinks(
    input: Partial<AuthorProfileSocialLinks>,
  ): Partial<AuthorProfileSocialLinks> {
    const result: Partial<
      Record<keyof AuthorProfileSocialLinks, string | null>
    > = {};
    for (const key of ['website', ...EDITABLE_SOCIAL_KEYS] as const) {
      if (!(key in input)) continue;
      const raw = input[key];
      result[key] =
        raw === null || raw === undefined ? null : this.normalizeUrl(key, raw);
    }
    return result;
  }

  private normalizeUrl(
    key: keyof AuthorProfileSocialLinks,
    value: string,
  ): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 500) {
      throw new InvalidInputException({
        code: 'AUTHOR_SOCIAL_URL_INVALID',
        message: 'Liên kết mạng xã hội tối đa 500 ký tự',
        details: { field: key },
      });
    }
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new InvalidInputException({
        code: 'AUTHOR_SOCIAL_URL_INVALID',
        message: 'Liên kết mạng xã hội không hợp lệ',
        details: { field: key },
      });
    }
    if (url.protocol !== 'https:') {
      throw new InvalidInputException({
        code: 'AUTHOR_SOCIAL_URL_INVALID',
        message: 'Liên kết mạng xã hội phải sử dụng HTTPS',
        details: { field: key },
      });
    }
    const host = url.hostname.toLocaleLowerCase('en');
    const allowedHosts: Partial<
      Record<keyof AuthorProfileSocialLinks, readonly string[]>
    > = {
      facebook: ['facebook.com', 'www.facebook.com'],
      instagram: ['instagram.com', 'www.instagram.com'],
      x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
      youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
      tiktok: ['tiktok.com', 'www.tiktok.com'],
    };
    const allowed = allowedHosts[key];
    if (allowed && !allowed.includes(host)) {
      throw new InvalidInputException({
        code: 'AUTHOR_SOCIAL_URL_INVALID',
        message: 'Tên miền mạng xã hội không khớp với trường đã chọn',
        details: { field: key },
      });
    }
    return url.toString();
  }

  private mergeEditableSocialLinks(
    current: Record<string, unknown>,
    input: Partial<AuthorProfileSocialLinks>,
  ): Record<string, unknown> {
    const next = { ...current };
    for (const key of EDITABLE_SOCIAL_KEYS) {
      if (!(key in input)) continue;
      const value = input[key];
      if (value === null || value === undefined) delete next[key];
      else next[key] = value;
    }
    return next;
  }

  private publicSocialLinks(
    websiteUrl: string | null,
    social: Record<string, unknown>,
  ): AuthorProfileSocialLinks {
    return {
      website: websiteUrl,
      facebook: this.stringValue(social['facebook']),
      instagram: this.stringValue(social['instagram']),
      x: this.stringValue(social['x']),
      youtube: this.stringValue(social['youtube']),
      tiktok: this.stringValue(social['tiktok']),
    };
  }

  private toView(record: {
    userId: string;
    penName: string;
    slug: string;
    biography: string | null;
    websiteUrl: string | null;
    socialLinks: unknown;
    verificationStatus: AuthorVerificationStatus;
    createdAt: Date;
    updatedAt: Date;
    bannerMedia: {
      id: string;
      secureUrl: string | null;
      publicUrl: string | null;
      status: MediaStatus;
      deletedAt: Date | null;
    } | null;
    user: {
      deletedAt: Date | null;
      avatarMedia: {
        id: string;
        secureUrl: string | null;
        publicUrl: string | null;
        status: MediaStatus;
        deletedAt: Date | null;
      } | null;
    };
  }): AuthorProfileView {
    const social = this.asJsonRecord(record.socialLinks);
    return {
      id: record.userId,
      displayName: record.penName,
      slug: record.slug,
      bio: record.biography,
      avatar: this.mediaView(record.user.avatarMedia),
      banner: this.mediaView(record.bannerMedia),
      socialLinks: this.publicSocialLinks(record.websiteUrl, social),
      verified: record.verificationStatus === AuthorVerificationStatus.VERIFIED,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mediaView(
    media: {
      id: string;
      secureUrl: string | null;
      publicUrl: string | null;
      status: MediaStatus;
      deletedAt: Date | null;
    } | null,
  ): { id: string; url: string } | null {
    if (!media || media.status !== MediaStatus.READY || media.deletedAt)
      return null;
    const url = media.secureUrl ?? media.publicUrl;
    return url ? { id: media.id, url } : null;
  }

  private asJsonRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private auditValues(value: Record<string, unknown>): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as Prisma.InputJsonObject;
  }

  private isPenNameConflict(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const record = error as {
      code?: unknown;
      meta?: unknown;
      message?: unknown;
    };
    if (record.code !== 'P2002') return false;
    const serialized = JSON.stringify(record.meta ?? record.message ?? '');
    return /pen.?name|author_profiles_pen_name_lower_unique/iu.test(serialized);
  }
}
