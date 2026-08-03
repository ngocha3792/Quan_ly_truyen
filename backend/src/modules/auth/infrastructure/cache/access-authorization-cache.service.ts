import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { CACHE_STORE } from '@/common/constants';

import type { PermissionCode, RoleCode } from '@/common/enums';

import type { AuthConfig } from '@/config';

import type { CacheStore } from '@/infrastructure/cache';

export interface AccessAuthorizationSnapshot {
  roles: readonly RoleCode[];

  permissions: readonly PermissionCode[];

  authorProfileId?: string;
}

interface CachedAccessAuthorizationV1 {
  version: 1;

  roles: readonly RoleCode[];

  permissions: readonly PermissionCode[];

  authorProfileId?: string;
}

@Injectable()
export class AccessAuthorizationCacheService {
  private readonly enabled: boolean;

  private readonly ttlSeconds: number;

  constructor(
    @Inject(CACHE_STORE)
    private readonly cache: CacheStore,

    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AuthConfig>('auth');

    this.enabled = config.accessAuthorizationCache?.enabled ?? false;

    this.ttlSeconds = config.accessAuthorizationCache?.ttlSeconds ?? 15;
  }

  async get(userId: string): Promise<AccessAuthorizationSnapshot | null> {
    if (!this.enabled) {
      return null;
    }

    const cached = await this.cache.get<CachedAccessAuthorizationV1>(
      this.key(userId),
    );

    if (!cached || cached.version !== 1) {
      return null;
    }

    return {
      roles: [...cached.roles],

      permissions: [...cached.permissions],

      authorProfileId: cached.authorProfileId,
    };
  }

  async set(
    userId: string,

    snapshot: AccessAuthorizationSnapshot,

    ttlSecondsCap?: number,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    /*
     * TTL không được vượt quá:
     *
     * - TTL cấu hình;
     * - thời gian còn lại của role sắp hết hạn.
     */
    const ttlSeconds = Math.max(
      1,

      Math.min(
        this.ttlSeconds,

        ttlSecondsCap ?? this.ttlSeconds,
      ),
    );

    await this.cache.set<CachedAccessAuthorizationV1>(
      this.key(userId),

      {
        version: 1,

        roles: [...snapshot.roles],

        permissions: [...snapshot.permissions],

        authorProfileId: snapshot.authorProfileId,
      },

      ttlSeconds,
    );
  }

  /**
   * Bắt buộc gọi sau khi:
   *
   * - thêm/xóa role;
   * - thêm/xóa permission;
   * - tạo/xóa author profile;
   * - ban/unban làm thay đổi authorization snapshot.
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.cache.delete(this.key(userId));
  }

  private key(userId: string): string {
    return ['auth', 'access-authorization', 'v1', 'user', userId].join(':');
  }
}
