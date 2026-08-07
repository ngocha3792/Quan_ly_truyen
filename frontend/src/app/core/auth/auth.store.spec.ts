import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    TestBed,
} from '@angular/core/testing';

import {
    firstValueFrom,
    of,
    throwError,
} from 'rxjs';

import {
    AuthApiService,
} from './auth-api.service';

import {
    AuthRefreshService,
} from './auth-refresh.service';

import {
    AuthSessionHintStore,
} from './auth-session-hint.store';

import {
    AuthStore,
} from './auth.store';

import {
    TokenStore,
} from './token.store';

import {
    createCurrentUser,
    createLoginResponse,
} from './testing/auth-test.fixtures';

describe(
    'AuthStore',
    () => {
        let store:
            AuthStore;

        let tokens:
            TokenStore;

        let api: {
            login:
            ReturnType<typeof vi.fn>;

            register:
            ReturnType<typeof vi.fn>;

            me:
            ReturnType<typeof vi.fn>;

            logout:
            ReturnType<typeof vi.fn>;

            beginMfaEnrollment:
            ReturnType<typeof vi.fn>;

            confirmMfaEnrollment:
            ReturnType<typeof vi.fn>;

            verifyMfa:
            ReturnType<typeof vi.fn>;
        };

        let refreshService: {
            refreshAccessToken:
            ReturnType<typeof vi.fn>;
        };

        let sessionHint: {
            shouldAttemptRefresh:
            ReturnType<typeof vi.fn>;

            markSessionPresent:
            ReturnType<typeof vi.fn>;

            markSessionAbsent:
            ReturnType<typeof vi.fn>;
        };

        beforeEach(() => {
            api = {
                login:
                    vi.fn(),

                register:
                    vi.fn(),

                me:
                    vi.fn(),

                logout:
                    vi.fn(),

                beginMfaEnrollment:
                    vi.fn(),

                confirmMfaEnrollment:
                    vi.fn(),

                verifyMfa:
                    vi.fn(),
            };

            refreshService = {
                refreshAccessToken:
                    vi.fn(),
            };

            sessionHint = {
                shouldAttemptRefresh:
                    vi.fn(),

                markSessionPresent:
                    vi.fn(),

                markSessionAbsent:
                    vi.fn(),
            };

            TestBed.configureTestingModule({
                providers: [
                    AuthStore,

                    TokenStore,

                    {
                        provide:
                            AuthApiService,

                        useValue:
                            api,
                    },

                    {
                        provide:
                            AuthRefreshService,

                        useValue:
                            refreshService,
                    },

                    {
                        provide:
                            AuthSessionHintStore,

                        useValue:
                            sessionHint,
                    },
                ],
            });

            store =
                TestBed.inject(
                    AuthStore,
                );

            tokens =
                TestBed.inject(
                    TokenStore,
                );
        });

        afterEach(() => {
            TestBed.resetTestingModule();
        });

        it(
            'không gọi refresh khi browser không có session hint',
            () => {
                sessionHint
                    .shouldAttemptRefresh
                    .mockReturnValue(
                        false,
                    );

                store.initialize();

                expect(
                    refreshService
                        .refreshAccessToken,
                ).not.toHaveBeenCalled();

                expect(
                    store.status(),
                ).toBe(
                    'anonymous',
                );

                expect(
                    store.user(),
                ).toBeNull();

                expect(
                    sessionHint
                        .markSessionAbsent,
                ).toHaveBeenCalled();
            },
        );

        it(
            'restore session bằng refresh + me',
            () => {
                const user =
                    createCurrentUser();

                sessionHint
                    .shouldAttemptRefresh
                    .mockReturnValue(
                        true,
                    );

                refreshService
                    .refreshAccessToken
                    .mockImplementation(
                        () => {
                            tokens.set(
                                'access-token-v2',
                            );

                            return of(
                                'access-token-v2',
                            );
                        },
                    );

                api.me.mockReturnValue(
                    of(user),
                );

                store.initialize();

                expect(
                    store.status(),
                ).toBe(
                    'authenticated',
                );

                expect(
                    store.user(),
                ).toEqual(
                    user,
                );

                expect(
                    tokens.accessToken(),
                ).toBe(
                    'access-token-v2',
                );

                expect(
                    sessionHint
                        .markSessionPresent,
                ).toHaveBeenCalled();
            },
        );

        it(
            'bootstrap chỉ xóa session hint khi backend từ chối phiên',
            () => {
                sessionHint
                    .shouldAttemptRefresh
                    .mockReturnValue(
                        true,
                    );

                refreshService
                    .refreshAccessToken
                    .mockReturnValue(
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status:
                                        401,
                                }),
                        ),
                    );

                store.initialize();

                expect(
                    store.status(),
                ).toBe(
                    'anonymous',
                );

                expect(
                    sessionHint
                        .markSessionAbsent,
                ).toHaveBeenCalledTimes(
                    1,
                );
            },
        );

        it(
            'bootstrap giữ session hint và cho retry khi lỗi tạm thời',
            () => {
                const user =
                    createCurrentUser();

                sessionHint
                    .shouldAttemptRefresh
                    .mockReturnValue(
                        true,
                    );

                refreshService
                    .refreshAccessToken
                    .mockReturnValueOnce(
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status:
                                        503,

                                    statusText:
                                        'Service Unavailable',
                                }),
                        ),
                    )
                    .mockImplementationOnce(
                        () => {
                            tokens.set(
                                'access-token-after-retry',
                            );

                            return of(
                                'access-token-after-retry',
                            );
                        },
                    );

                api.me.mockReturnValue(
                    of(user),
                );

                store.initialize();

                expect(
                    store.status(),
                ).toBe(
                    'idle',
                );

                expect(
                    sessionHint
                        .markSessionAbsent,
                ).not.toHaveBeenCalled();

                store.initialize();

                expect(
                    refreshService
                        .refreshAccessToken,
                ).toHaveBeenCalledTimes(
                    2,
                );

                expect(
                    store.status(),
                ).toBe(
                    'authenticated',
                );
            },
        );

        it(
            'bootstrap chỉ được chạy một lần',
            () => {
                sessionHint
                    .shouldAttemptRefresh
                    .mockReturnValue(
                        false,
                    );

                store.initialize();

                store.initialize();

                store.initialize();

                expect(
                    sessionHint
                        .shouldAttemptRefresh,
                ).toHaveBeenCalledTimes(
                    1,
                );
            },
        );

        it(
            'login lưu access token rồi gọi /me',
            async () => {
                const user =
                    createCurrentUser();

                api.login.mockReturnValue(
                    of(
                        createLoginResponse(
                            'access-token-login',
                            user,
                        ),
                    ),
                );

                api.me.mockReturnValue(
                    of(user),
                );

                const result =
                    await firstValueFrom(
                        store.login({
                            identifier:
                                user.email,

                            password:
                                'Password@123',

                            deviceName:
                                'Vitest',
                        }),
                    );

                expect(result).toEqual(
                    user,
                );

                expect(
                    tokens.accessToken(),
                ).toBe(
                    'access-token-login',
                );

                expect(
                    store.status(),
                ).toBe(
                    'authenticated',
                );

                expect(
                    store.isAuthenticated(),
                ).toBe(true);

                expect(
                    sessionHint
                        .markSessionPresent,
                ).toHaveBeenCalled();
            },
        );

        it(
            'login fail phải clear local session',
            async () => {
                tokens.set(
                    'old-token',
                );

                api.login.mockReturnValue(
                    throwError(
                        () =>
                            new Error(
                                'Sai mật khẩu',
                            ),
                    ),
                );

                await expect(
                    firstValueFrom(
                        store.login({
                            identifier:
                                'user@test.com',

                            password:
                                'wrong',
                        }),
                    ),
                ).rejects.toThrow(
                    'Sai mật khẩu',
                );

                expect(
                    store.status(),
                ).toBe(
                    'anonymous',
                );

                expect(
                    store.user(),
                ).toBeNull();

                expect(
                    tokens.accessToken(),
                ).toBeNull();

                expect(
                    store.error(),
                ).toBe(
                    'Sai mật khẩu',
                );
            },
        );

        it(
            'refresh session thành công phải cập nhật CurrentUser',
            async () => {
                const user =
                    createCurrentUser({
                        displayName:
                            'User After Refresh',
                    });

                refreshService
                    .refreshAccessToken
                    .mockImplementation(
                        () => {
                            tokens.set(
                                'new-access',
                            );

                            return of(
                                'new-access',
                            );
                        },
                    );

                api.me.mockReturnValue(
                    of(user),
                );

                const result =
                    await firstValueFrom(
                        store.refreshSession(),
                    );

                expect(result).toEqual(
                    user,
                );

                expect(
                    store.user()
                        ?.displayName,
                ).toBe(
                    'User After Refresh',
                );

                expect(
                    store.status(),
                ).toBe(
                    'authenticated',
                );
            },
        );

        it(
            'refresh session fail phải chuyển anonymous',
            async () => {
                tokens.set(
                    'expired-token',
                );

                refreshService
                    .refreshAccessToken
                    .mockReturnValue(
                        throwError(
                            () =>
                                new Error(
                                    'Refresh expired',
                                ),
                        ),
                    );

                await expect(
                    firstValueFrom(
                        store.refreshSession(),
                    ),
                ).rejects.toThrow(
                    'Refresh expired',
                );

                expect(
                    store.status(),
                ).toBe(
                    'anonymous',
                );

                expect(
                    tokens.accessToken(),
                ).toBeNull();
            },
        );

        it(
            'logout luôn clear local state kể cả backend logout thành công',
            () => {
                const user =
                    createCurrentUser();

                store.replaceCurrentUser(
                    user,
                );

                tokens.set(
                    'access-token',
                );

                api.logout.mockReturnValue(
                    of(undefined),
                );

                store.logout();

                expect(
                    api.logout,
                ).toHaveBeenCalledTimes(
                    1,
                );

                expect(
                    store.status(),
                ).toBe(
                    'anonymous',
                );

                expect(
                    store.user(),
                ).toBeNull();

                expect(
                    tokens.accessToken(),
                ).toBeNull();
            },
        );

        it(
            'MFA enrollment confirm phải hoàn tất login và giữ recovery codes',
            async () => {
                const user =
                    createCurrentUser();

                api
                    .confirmMfaEnrollment
                    .mockReturnValue(
                        of({
                            ...createLoginResponse(
                                'mfa-access',
                                user,
                            ),

                            recoveryCodes: [
                                'RECOVERY-1',
                                'RECOVERY-2',
                            ],
                        }),
                    );

                api.me.mockReturnValue(
                    of(user),
                );

                const result =
                    await firstValueFrom(
                        store.confirmMfaEnrollment({
                            mfaTicket:
                                'ticket-1',

                            totpCode:
                                '123456',

                            deviceName:
                                'Vitest',
                        }),
                    );

                expect(
                    result.user,
                ).toEqual(user);

                expect(
                    result.recoveryCodes,
                ).toEqual([
                    'RECOVERY-1',
                    'RECOVERY-2',
                ]);

                expect(
                    store.isAuthenticated(),
                ).toBe(true);

                expect(
                    tokens.accessToken(),
                ).toBe(
                    'mfa-access',
                );
            },
        );
    },
);
