import { TestBed } from '@angular/core/testing';

import { firstValueFrom, of, Subject } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';

import { AdminUsersApiService } from './admin-users-api.service';

import { AdminUsersStore } from './admin-users.store';

describe('AdminUsersStore', () => {
  let store: AdminUsersStore;

  let lifecycle: AuthSessionLifecycleService;

  let api: {
    list: ReturnType<typeof vi.fn>;

    getOne: ReturnType<typeof vi.fn>;

    updateStatus: ReturnType<typeof vi.fn>;

    assignRole: ReturnType<typeof vi.fn>;

    removeRole: ReturnType<typeof vi.fn>;
  };

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
        AdminUsersStore,

        AuthSessionLifecycleService,

        {
          provide: AdminUsersApiService,

          useValue: api,
        },
      ],
    });

    lifecycle = TestBed.inject(AuthSessionLifecycleService);

    store = TestBed.inject(AdminUsersStore);

    lifecycle.establishSession(
      'manager-a',

      'manager-session-a',

      false,
    );
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('suspend phải cập nhật detail theo server response', async () => {
    api.getOne.mockReturnValue(of(user('ACTIVE')));

    store.loadDetail('managed-user');

    api.updateStatus.mockReturnValue(of(user('SUSPENDED')));

    await firstValueFrom(store.updateStatus('SUSPENDED'));

    expect(api.updateStatus).toHaveBeenCalledWith(
      'managed-user',

      'SUSPENDED',
    );

    expect(store.detail()?.status).toBe('SUSPENDED');

    expect(store.actionMessage()).toContain('tạm khóa');
  });

  it('assign ADMIN phải cập nhật role trong detail', async () => {
    api.getOne.mockReturnValue(of(user('ACTIVE')));

    store.loadDetail('managed-user');

    api.assignRole.mockReturnValue(
      of({
        ...user('ACTIVE'),

        roles: [
          baseUserRole,

          {
            code: 'ADMIN',

            name: 'Admin',

            assignedAt: '2026-08-08T12:00:00.000Z',

            expiresAt: null,
          },
        ],
      }),
    );

    await firstValueFrom(store.assignAdminRole());

    expect(store.detail()?.roles.some((role) => role.code === 'ADMIN')).toBe(true);
  });

  it('detail response cũ không được ghi vào session manager mới', () => {
    const result$ = new Subject<ReturnType<typeof user>>();

    api.getOne.mockReturnValue(result$.asObservable());

    store.loadDetail('managed-user');

    lifecycle.establishSession(
      'manager-b',

      'manager-session-b',

      false,
    );

    result$.next(user('ACTIVE'));

    result$.complete();

    expect(store.detail()).toBeNull();
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
