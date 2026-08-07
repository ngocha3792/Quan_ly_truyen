import {
    provideHttpClient,
} from '@angular/common/http';

import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';

import {
    TestBed,
} from '@angular/core/testing';

import {
    firstValueFrom,
} from 'rxjs';

import {
    APP_RUNTIME_CONFIG,
} from '../config/app-config.token';

import {
    SKIP_AUTH_REFRESH,
} from '../http/auth-http.context';

import {
    AuthApiService,
} from './auth-api.service';

describe(
    'AuthApiService',
    () => {
        let service:
            AuthApiService;

        let http:
            HttpTestingController;

        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideHttpClient(),

                    provideHttpClientTesting(),

                    {
                        provide:
                            APP_RUNTIME_CONFIG,

                        useValue: {
                            apiBaseUrl:
                                '/api/v1',

                            appName:
                                'TruyenHub',

                            production:
                                false,
                        },
                    },
                ],
            });

            service =
                TestBed.inject(
                    AuthApiService,
                );

            http =
                TestBed.inject(
                    HttpTestingController,
                );
        });

        afterEach(() => {
            http.verify();

            TestBed.resetTestingModule();
        });

        it(
            'register gửi idempotency key và skip refresh',
            async () => {
                const promise =
                    firstValueFrom(
                        service.register({
                            email:
                                'new@truyenhub.test',

                            username:
                                'new_user',

                            displayName:
                                'New User',

                            password:
                                'Password@123',
                        }),
                    );

                const request =
                    http.expectOne(
                        '/api/v1/auth/register',
                    );

                expect(
                    request.request
                        .method,
                ).toBe(
                    'POST',
                );

                expect(
                    request.request
                        .headers
                        .get(
                            'x-idempotency-key',
                        ),
                ).toBeTruthy();

                expect(
                    request.request
                        .context
                        .get(
                            SKIP_AUTH_REFRESH,
                        ),
                ).toBe(true);

                request.flush(
                    successEnvelope({
                        id:
                            'user-1',

                        email:
                            'new@truyenhub.test',

                        username:
                            'new_user',

                        displayName:
                            'New User',

                        verificationRequired:
                            true as const,
                    }),
                );

                const result =
                    await promise;

                expect(
                    result.verificationRequired,
                ).toBe(true);
            },
        );

        it(
            'refresh luôn skip auth refresh interceptor',
            async () => {
                const promise =
                    firstValueFrom(
                        service.refresh(),
                    );

                const request =
                    http.expectOne(
                        '/api/v1/auth/refresh',
                    );

                expect(
                    request.request
                        .context
                        .get(
                            SKIP_AUTH_REFRESH,
                        ),
                ).toBe(true);

                request.flush(
                    successEnvelope({
                        sessionId:
                            'session-1',

                        accessToken:
                            'access-v2',

                        tokenType:
                            'Bearer' as const,

                        expiresIn:
                            900,

                        expiresAt:
                            '2026-08-07T13:00:00.000Z',
                    }),
                );

                const result =
                    await promise;

                expect(
                    result.accessToken,
                ).toBe(
                    'access-v2',
                );
            },
        );

        it(
            'resend verification dùng đúng contract',
            async () => {
                const promise =
                    firstValueFrom(
                        service
                            .resendVerification(
                                'USER@EXAMPLE.COM',
                            ),
                    );

                const request =
                    http.expectOne(
                        '/api/v1/auth/resend-verification',
                    );

                expect(
                    request.request
                        .method,
                ).toBe(
                    'POST',
                );

                expect(
                    request.request
                        .body,
                ).toEqual({
                    email:
                        'USER@EXAMPLE.COM',
                });

                expect(
                    request.request
                        .context
                        .get(
                            SKIP_AUTH_REFRESH,
                        ),
                ).toBe(true);

                request.flush(
                    successEnvelope({
                        accepted:
                            true as const,

                        message:
                            'Nếu email hợp lệ, hệ thống sẽ gửi email xác minh.',
                    }),
                );

                const result =
                    await promise;

                expect(
                    result.accepted,
                ).toBe(true);
            },
        );

        it(
            'confirm email change dùng token và skip refresh',
            async () => {
                const promise =
                    firstValueFrom(
                        service
                            .confirmEmailChange(
                                'email-change-token',
                            ),
                    );

                const request =
                    http.expectOne(
                        '/api/v1/auth/change-email/confirm',
                    );

                expect(
                    request.request
                        .body,
                ).toEqual({
                    token:
                        'email-change-token',
                });

                expect(
                    request.request
                        .context
                        .get(
                            SKIP_AUTH_REFRESH,
                        ),
                ).toBe(true);

                request.flush(
                    successEnvelope({
                        emailChanged:
                            true as const,

                        alreadyChanged:
                            false,

                        previousEmail:
                            'old@test.com',

                        email:
                            'new@test.com',

                        sessionsRevoked:
                            2,

                        reauthenticationRequired:
                            true as const,

                        changedAt:
                            '2026-08-07T12:00:00.000Z',
                    }),
                );

                const result =
                    await promise;

                expect(
                    result.email,
                ).toBe(
                    'new@test.com',
                );

                expect(
                    result.reauthenticationRequired,
                ).toBe(true);
            },
        );
    },
);

function successEnvelope<T>(
    data: T,
) {
    return {
        success:
            true as const,

        data,

        requestId:
            'test-request',

        timestamp:
            '2026-08-07T12:00:00.000Z',
    };
}