import { signal, WritableSignal } from '@angular/core';

import { TestBed } from '@angular/core/testing';

import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { firstValueFrom, isObservable, of } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authenticatedGuard } from './authenticated.guard';

import { AuthAuthorizationSyncService } from './auth-authorization-sync.service';

import { AUTH_PERMISSIONS, AUTH_ROLES } from './authorization.models';

import { CurrentUser } from './auth.models';

import { AuthStatus, AuthStore } from './auth.store';

import { permissionGuard } from './permission.guard';

import { roleGuard } from './role.guard';

import { createCurrentUser } from './testing/auth-test.fixtures';

describe('Auth authorization guards', () => {
  let router: Router;

  let statusState: WritableSignal<AuthStatus>;

  let userState: WritableSignal<CurrentUser | null>;

  let auth: AuthStore;

  let authorizationSync: {
    revalidateCurrentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    statusState = signal<AuthStatus>('anonymous');

    userState = signal<CurrentUser | null>(null);

    auth = {
      status: statusState.asReadonly(),

      user: userState.asReadonly(),

      initialize: vi.fn(),
    } as unknown as AuthStore;

    authorizationSync = {
      revalidateCurrentUser: vi.fn(() => of(userState())),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),

        {
          provide: AuthStore,

          useValue: auth,
        },

        {
          provide: AuthAuthorizationSyncService,

          useValue: authorizationSync,
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('anonymous user được redirect tới login kèm returnUrl', async () => {
    const result = await executeGuard(
      authenticatedGuard,

      '/thu-vien',
    );

    expect(serialize(result)).toBe('/dang-nhap?returnUrl=%2Fthu-vien');
  });

  it('authenticated user được đi qua authenticatedGuard', async () => {
    authenticate(createCurrentUser());

    const result = await executeGuard(
      authenticatedGuard,

      '/thu-vien',
    );

    expect(result).toBe(true);
  });

  it('guard chờ AuthStore bootstrap khi status đang idle', async () => {
    statusState.set('idle');

    vi.mocked(auth.initialize).mockImplementation(() => {
      userState.set(createCurrentUser());

      statusState.set('authenticated');
    });

    const result = await executeGuard(
      authenticatedGuard,

      '/tai-khoan',
    );

    expect(auth.initialize).toHaveBeenCalledTimes(1);

    expect(result).toBe(true);
  });

  it('USER không được vào route AUTHOR', async () => {
    authenticate(
      createCurrentUser({
        roles: ['USER'],
      }),
    );

    const result = await executeGuard(
      roleGuard(AUTH_ROLES.AUTHOR),

      '/author-studio',
    );

    expect(serialize(result)).toBe('/khong-co-quyen?reason=role&from=%2Fauthor-studio');
  });

  it('AUTHOR được vượt qua roleGuard', async () => {
    authenticate(
      createCurrentUser({
        roles: ['AUTHOR'],
      }),
    );

    const result = await executeGuard(
      roleGuard(AUTH_ROLES.AUTHOR),

      '/author-studio',
    );

    expect(result).toBe(true);
  });

  it('role guard xử lý role không phân biệt hoa thường', async () => {
    authenticate(
      createCurrentUser({
        roles: ['author'],
      }),
    );

    const result = await executeGuard(
      roleGuard(AUTH_ROLES.AUTHOR),

      '/author-studio',
    );

    expect(result).toBe(true);
  });

  it('permissionGuard cho phép user có permission', async () => {
    authenticate(
      createCurrentUser({
        permissions: ['library.manage.own'],
      }),
    );

    const result = await executeGuard(
      permissionGuard(AUTH_PERMISSIONS.LIBRARY_MANAGE_OWN),

      '/thu-vien',
    );

    expect(result).toBe(true);
  });

  it('permissionGuard từ chối user thiếu permission', async () => {
    authenticate(
      createCurrentUser({
        permissions: [],
      }),
    );

    const result = await executeGuard(
      permissionGuard(AUTH_PERMISSIONS.LIBRARY_MANAGE_OWN),

      '/thu-vien',
    );

    expect(serialize(result)).toBe('/khong-co-quyen?reason=permission&from=%2Fthu-vien');
  });

  it('permissionGuard không phân biệt hoa thường', async () => {
    authenticate(
      createCurrentUser({
        permissions: ['LIBRARY.MANAGE.OWN'],
      }),
    );

    const result = await executeGuard(
      permissionGuard(AUTH_PERMISSIONS.LIBRARY_MANAGE_OWN),

      '/thu-vien',
    );

    expect(result).toBe(true);
  });

  it('roleGuard revalidate CurrentUser trước khi từ chối role stale', async () => {
    authenticate(
      createCurrentUser({
        roles: ['USER'],
      }),
    );

    const freshUser = createCurrentUser({
      roles: ['USER', 'AUTHOR'],
    });

    authorizationSync.revalidateCurrentUser.mockReturnValue(of(freshUser));

    const result = await executeGuard(
      roleGuard(AUTH_ROLES.AUTHOR),

      '/author-studio',
    );

    expect(authorizationSync.revalidateCurrentUser).toHaveBeenCalledTimes(1);

    expect(result).toBe(true);
  });

  it('permissionGuard revalidate CurrentUser trước khi từ chối permission stale', async () => {
    authenticate(
      createCurrentUser({
        permissions: [],
      }),
    );

    const freshUser = createCurrentUser({
      permissions: [AUTH_PERMISSIONS.LIBRARY_MANAGE_OWN],
    });

    authorizationSync.revalidateCurrentUser.mockReturnValue(of(freshUser));

    const result = await executeGuard(
      permissionGuard(AUTH_PERMISSIONS.LIBRARY_MANAGE_OWN),

      '/thu-vien',
    );

    expect(authorizationSync.revalidateCurrentUser).toHaveBeenCalledTimes(1);

    expect(result).toBe(true);
  });

  function authenticate(user: CurrentUser): void {
    userState.set(user);

    statusState.set('authenticated');
  }

  async function executeGuard(
    guard: CanActivateFn,

    url: string,
  ): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard(
        {} as ActivatedRouteSnapshot,

        {
          url,
        } as RouterStateSnapshot,
      ),
    );

    if (isObservable(result)) {
      return firstValueFrom(result) as Promise<boolean | UrlTree>;
    }

    return Promise.resolve(result) as Promise<boolean | UrlTree>;
  }

  function serialize(result: boolean | UrlTree): string {
    expect(result).toBeInstanceOf(UrlTree);

    return router.serializeUrl(result as UrlTree);
  }
});
