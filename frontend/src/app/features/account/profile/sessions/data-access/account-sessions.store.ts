import {
    computed,
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    catchError,
    finalize,
    forkJoin,
    Observable,
    of,
    tap,
    throwError,
} from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

import {
    AccountSecurityEventDto,
    AccountSessionDto,
    AccountSessionViewModel,
    LoginActivityViewModel,
    SessionFilter,
} from '../domain/account-session.models';

import {
    normalizeSearchText,
    toLoginActivityViewModel,
    toSessionViewModel,
} from '../utils/session-device.util';

import { AccountSessionsApiService } from './account-sessions-api.service';

@Injectable({
    providedIn: 'root',
})
export class AccountSessionsStore {
    private readonly api =
        inject(AccountSessionsApiService);

    private readonly rawSessionsState =
        signal<readonly AccountSessionDto[]>(
            [],
        );

    private readonly eventsState =
        signal<
            readonly AccountSecurityEventDto[]
        >([]);

    private readonly loadingState =
        signal(false);

    private readonly submittingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private readonly successState =
        signal<string | null>(null);

    private readonly queryState =
        signal('');

    private readonly filterState =
        signal<SessionFilter>('all');

    private readonly revokingIdsState =
        signal<ReadonlySet<string>>(
            new Set(),
        );

    private loaded = false;

    readonly loading =
        this.loadingState.asReadonly();

    readonly submitting =
        this.submittingState.asReadonly();

    readonly error =
        this.errorState.asReadonly();

    readonly success =
        this.successState.asReadonly();

    readonly query =
        this.queryState.asReadonly();

    readonly filter =
        this.filterState.asReadonly();

    readonly revokingIds =
        this.revokingIdsState.asReadonly();

    readonly sessions = computed(
        () =>
            this.rawSessionsState()
                .map((session) =>
                    toSessionViewModel(session),
                )
                .sort(
                    (left, right) =>
                        new Date(
                            right.lastUsedAt,
                        ).getTime() -
                        new Date(
                            left.lastUsedAt,
                        ).getTime(),
                ),
    );

    readonly currentSession =
        computed<
            AccountSessionViewModel | null
        >(
            () =>
                this.sessions().find(
                    (session) =>
                        session.isCurrent,
                ) ?? null,
        );

    readonly otherSessions = computed(
        () =>
            this.sessions().filter(
                (session) =>
                    !session.isCurrent,
            ),
    );

    readonly filteredSessions =
        computed(() => {
            const query =
                normalizeSearchText(
                    this.queryState(),
                );

            const filter =
                this.filterState();

            return this.otherSessions().filter(
                (session) => {
                    const matchesFilter =
                        filter === 'all' ||
                        (filter === 'active' &&
                            session.status ===
                            'active') ||
                        (filter === 'expired' &&
                            (session.status ===
                                'expired' ||
                                session.status ===
                                'revoked')) ||
                        (filter === 'trusted' &&
                            session.trusted);

                    if (!matchesFilter) {
                        return false;
                    }

                    if (!query) {
                        return true;
                    }

                    const searchContent =
                        normalizeSearchText(
                            [
                                session.title,
                                session.subtitle,
                                session.location,
                                session.ipAddress ?? '',
                            ].join(' '),
                        );

                    return searchContent.includes(
                        query,
                    );
                },
            );
        });

    readonly activeSessionCount =
        computed(
            () =>
                this.sessions().filter(
                    (session) =>
                        session.status ===
                        'active' ||
                        session.status ===
                        'current',
                ).length,
        );

    readonly trustedDeviceCount =
        computed(
            () =>
                this.sessions().filter(
                    (session) =>
                        session.trusted,
                ).length,
        );

    readonly latestLoginAt =
        computed<string | null>(() => {
            const dates = this.sessions()
                .map((session) =>
                    new Date(
                        session.lastUsedAt,
                    ).getTime(),
                )
                .filter(Number.isFinite);

            if (dates.length === 0) {
                return null;
            }

            return new Date(
                Math.max(...dates),
            ).toISOString();
        });

    readonly recentLogins =
        computed<
            readonly LoginActivityViewModel[]
        >(() => {
            const securityActivities =
                this.eventsState()
                    .filter((event) => {
                        const action =
                            event.action.toLowerCase();

                        return (
                            action.includes('login') ||
                            action.includes('session') ||
                            action.includes('logout')
                        );
                    })
                    .map(
                        toLoginActivityViewModel,
                    )
                    .slice(0, 5);

            if (
                securityActivities.length > 0
            ) {
                return securityActivities;
            }

            return this.sessions()
                .slice(0, 5)
                .map((session) => ({
                    id: session.id,

                    browser: session.browser,
                    title: session.title,
                    subtitle: session.subtitle,

                    location: session.location,
                    ipAddress:
                        session.ipAddress,

                    occurredAt:
                        session.lastUsedAt,

                    status: session.isCurrent
                        ? 'current' as const
                        : session.status ===
                            'active'
                            ? 'active' as const
                            : 'signed-out' as const,

                    statusLabel:
                        session.isCurrent
                            ? 'Hiện tại'
                            : session.status ===
                                'active'
                                ? 'Hoạt động'
                                : 'Đã đăng xuất',
                }));
        });

    readonly revocableSessionCount =
        computed(
            () =>
                this.otherSessions().filter(
                    (session) =>
                        session.canRevoke,
                ).length,
        );

    load(force = false): void {
        if (
            this.loadingState() ||
            (this.loaded && !force)
        ) {
            return;
        }

        this.loadingState.set(true);
        this.errorState.set(null);

        forkJoin({
            sessions:
                this.api.getSessions(),

            securityEvents:
                this.api
                    .getRecentSecurityEvents(12)
                    .pipe(
                        catchError(() =>
                            of({
                                events: [],
                                total: 0,
                            }),
                        ),
                    ),
        })
            .pipe(
                finalize(() => {
                    this.loadingState.set(false);
                }),
            )
            .subscribe({
                next: ({
                    sessions,
                    securityEvents,
                }) => {
                    this.rawSessionsState.set(
                        sessions.sessions,
                    );

                    this.eventsState.set(
                        securityEvents.events,
                    );

                    this.loaded = true;
                },

                error: (error: unknown) => {
                    this.errorState.set(
                        getApiErrorMessage(error),
                    );
                },
            });
    }

    reload(): void {
        this.load(true);
    }

    setQuery(query: string): void {
        this.queryState.set(query);
    }

    setFilter(
        filter: SessionFilter,
    ): void {
        this.filterState.set(filter);
    }

    revokeSession(
        sessionId: string,
    ): Observable<void> {
        const session =
            this.sessions().find(
                (item) =>
                    item.id === sessionId,
            );

        if (
            !session ||
            !session.canRevoke
        ) {
            return throwError(
                () =>
                    new Error(
                        'Phiên đăng nhập này không thể thu hồi.',
                    ),
            );
        }

        this.errorState.set(null);
        this.successState.set(null);

        this.addRevokingId(sessionId);

        return this.api
            .revokeSession(sessionId)
            .pipe(
                tap(() => {
                    this.removeSession(
                        sessionId,
                    );

                    this.successState.set(
                        `Đã thu hồi phiên ${session.title}.`,
                    );
                }),

                catchError((error: unknown) => {
                    this.errorState.set(
                        getApiErrorMessage(error),
                    );

                    return throwError(
                        () => error,
                    );
                }),

                finalize(() => {
                    this.removeRevokingId(
                        sessionId,
                    );
                }),
            );
    }

    revokeAllOtherSessions():
        Observable<void> {
        const sessions =
            this.otherSessions().filter(
                (session) =>
                    session.canRevoke,
            );

        if (sessions.length === 0) {
            this.successState.set(
                'Không có phiên nào cần thu hồi.',
            );

            return of(undefined);
        }

        this.submittingState.set(true);
        this.errorState.set(null);
        this.successState.set(null);

        const ids = sessions.map(
            (session) => session.id,
        );

        this.revokingIdsState.set(
            new Set(ids),
        );

        return forkJoin(
            ids.map((sessionId) =>
                this.api.revokeSession(
                    sessionId,
                ),
            ),
        ).pipe(
            tap(() => {
                const idSet = new Set(ids);

                this.rawSessionsState.update(
                    (currentSessions) =>
                        currentSessions.filter(
                            (session) =>
                                !idSet.has(
                                    session.id,
                                ),
                        ),
                );

                this.successState.set(
                    `Đã thu hồi ${ids.length} phiên đăng nhập khác.`,
                );
            }),

            mapToVoid(),

            catchError((error: unknown) => {
                this.errorState.set(
                    getApiErrorMessage(error),
                );

                return throwError(
                    () => error,
                );
            }),

            finalize(() => {
                this.submittingState.set(false);
                this.revokingIdsState.set(
                    new Set(),
                );
            }),
        );
    }

    clearMessages(): void {
        this.errorState.set(null);
        this.successState.set(null);
    }

    private removeSession(
        sessionId: string,
    ): void {
        this.rawSessionsState.update(
            (sessions) =>
                sessions.filter(
                    (session) =>
                        session.id !== sessionId,
                ),
        );
    }

    private addRevokingId(
        sessionId: string,
    ): void {
        const next = new Set(
            this.revokingIdsState(),
        );

        next.add(sessionId);

        this.revokingIdsState.set(next);
    }

    private removeRevokingId(
        sessionId: string,
    ): void {
        const next = new Set(
            this.revokingIdsState(),
        );

        next.delete(sessionId);

        this.revokingIdsState.set(next);
    }
}

function mapToVoid() {
    return (
        source: Observable<unknown>,
    ): Observable<void> =>
        new Observable<void>(
            (subscriber) => {
                const subscription =
                    source.subscribe({
                        next: () => {
                            subscriber.next();
                        },

                        error: (error) => {
                            subscriber.error(error);
                        },

                        complete: () => {
                            subscriber.complete();
                        },
                    });

                return () =>
                    subscription.unsubscribe();
            },
        );
}