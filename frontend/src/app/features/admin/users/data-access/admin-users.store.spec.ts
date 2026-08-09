import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { AdminUserActionsStore } from './admin-user-actions.store';
import { AdminUserDetailStore } from './admin-user-detail.store';
import { AdminUsersApiService } from './admin-users-api.service';

describe('Admin user detail/actions stores', () => {
  let detailStore: AdminUserDetailStore;
  let actionsStore: AdminUserActionsStore;
  let lifecycle: AuthSessionLifecycleService;
  let api: Record<
    'list' | 'getOne' | 'updateStatus' | 'assignRole' | 'removeRole',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(() => {
    api = {
      list: vi.fn(),
      getOne: vi.fn(),
      updateStatus: vi.fn(),
      assignRole: vi.fn(),
      removeRole: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        AdminUserDetailStore,
        AdminUserActionsStore,
        AuthSessionLifecycleService,
        { provide: AdminUsersApiService, useValue: api },
      ],
    });
    lifecycle = TestBed.inject(AuthSessionLifecycleService);
    detailStore = TestBed.inject(AdminUserDetailStore);
    actionsStore = TestBed.inject(AdminUserActionsStore);
    lifecycle.establishSession('manager-a', 'manager-session-a', false);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('suspend cập nhật detail theo server response', async () => {
    api.getOne.mockReturnValue(of(user('ACTIVE')));
    detailStore.load('managed-user');
    api.updateStatus.mockReturnValue(of(user('SUSPENDED')));
    await firstValueFrom(actionsStore.updateStatus('SUSPENDED'));
    expect(api.updateStatus).toHaveBeenCalledWith('managed-user', 'SUSPENDED');
    expect(detailStore.detail()?.status).toBe('SUSPENDED');
    expect(actionsStore.message()).toContain('tạm khóa');
  });

  it('assign ADMIN cập nhật role trong detail', async () => {
    api.getOne.mockReturnValue(of(user('ACTIVE')));
    detailStore.load('managed-user');
    api.assignRole.mockReturnValue(
      of({
        ...user('ACTIVE'),
        roles: [
          baseUserRole,
          { code: 'ADMIN', name: 'Admin', assignedAt: '2026-08-08T12:00:00.000Z', expiresAt: null },
        ],
      }),
    );
    await firstValueFrom(actionsStore.assignAdminRole());
    expect(detailStore.detail()?.roles.some((role) => role.code === 'ADMIN')).toBe(true);
  });

  it('detail response cũ không chảy sang session manager mới', () => {
    const result$ = new Subject<ReturnType<typeof user>>();
    api.getOne.mockReturnValue(result$.asObservable());
    detailStore.load('managed-user');
    lifecycle.establishSession('manager-b', 'manager-session-b', false);
    result$.next(user('ACTIVE'));
    result$.complete();
    expect(detailStore.detail()).toBeNull();
  });
});

const baseUserRole = {
  code: 'USER' as const,
  name: 'User',
  assignedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: null,
};
function user(status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') {
  return {
    id: 'managed-user',
    email: 'managed@example.test',
    username: 'managed_user',
    displayName: 'Managed User',
    status,
    emailVerified: true,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    roles: [baseUserRole],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    bio: null,
    avatar: null,
    authorProfile: null,
    activeSessionCount: 1,
    deletedAt: null,
  } as const;
}
