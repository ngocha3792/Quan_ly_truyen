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
    of,
} from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

import {
    AccountSecurityEventDto,
    ActivityCategory,
    ActivitySessionDto,
    ActivitySummary,
    WeeklySummaryItem,
} from '../domain/account-activity.models';

import {
    mapSecurityEvent,
    mapSessionToRecentDevice,
    normalizeSearchText,
} from '../utils/account-activity.mapper';

import { AccountActivityApiService } from './account-activity-api.service';

const DEFAULT_VISIBLE_COUNT = 10;

@Injectable({
    providedIn: 'root',
})
export class AccountActivityStore {
    private readonly api =
        inject(AccountActivityApiService);

    private readonly eventsState =
        signal<
            readonly AccountSecurityEventDto[]
        >([]);

    private readonly sessionsState =
        signal<
            readonly ActivitySessionDto[]
        >([]);

    private readonly loadingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private readonly queryState =
        signal('');

    private readonly categoryState =
        signal<ActivityCategory>('all');

    private readonly periodDaysState =
        signal<7 | 30 | 90>(7);

    private readonly visibleCountState =
        signal(DEFAULT_VISIBLE_COUNT);

    private loaded = false;

    readonly loading =
        this.loadingState.asReadonly();

    readonly error =
        this.errorState.asReadonly();

    readonly query =
        this.queryState.asReadonly();

    readonly category =
        this.categoryState.asReadonly();

    readonly periodDays =
        this.periodDaysState.asReadonly();

    readonly allActivities = computed(
        () =>
            this.eventsState()
                .map(mapSecurityEvent)
                .sort(
                    (left, right) =>
                        new Date(
                            right.occurredAt,
                        ).getTime() -
                        new Date(
                            left.occurredAt,
                        ).getTime(),
                ),
    );

    readonly periodActivities =
        computed(() => {
            const threshold =
                Date.now() -
                this.periodDaysState() *
                86_400_000;

            return this.allActivities().filter(
                (activity) => {
                    const timestamp =
                        new Date(
                            activity.occurredAt,
                        ).getTime();

                    return (
                        Number.isFinite(timestamp) &&
                        timestamp >= threshold
                    );
                },
            );
        });

    readonly filteredActivities =
        computed(() => {
            const category =
                this.categoryState();

            const query =
                normalizeSearchText(
                    this.queryState(),
                );

            return this.periodActivities().filter(
                (activity) => {
                    if (
                        category !== 'all' &&
                        activity.category !== category
                    ) {
                        return false;
                    }

                    if (!query) {
                        return true;
                    }

                    const searchable =
                        normalizeSearchText(
                            [
                                activity.title,
                                activity.description,
                                activity.deviceLabel,
                                activity.browserName,
                                activity.operatingSystem,
                                activity.location,
                                activity.ipAddress ?? '',
                            ].join(' '),
                        );

                    return searchable.includes(
                        query,
                    );
                },
            );
        });

    readonly visibleActivities =
        computed(() =>
            this.filteredActivities().slice(
                0,
                this.visibleCountState(),
            ),
        );

    readonly hasMore = computed(
        () =>
            this.visibleCountState() <
            this.filteredActivities().length,
    );

    readonly summary =
        computed<ActivitySummary>(() => {
            const activities =
                this.periodActivities();

            const activeDevices =
                this.sessionsState().filter(
                    (session) =>
                        isSessionActive(session),
                );

            return {
                total: activities.length,

                loginCount:
                    activities.filter(
                        (activity) =>
                            activity.category ===
                            'login',
                    ).length,

                securityCount:
                    activities.filter(
                        (activity) =>
                            activity.category ===
                            'security',
                    ).length,

                activeDeviceCount:
                    activeDevices.length,
            };
        });

    readonly recentDevices = computed(
        () =>
            this.sessionsState()
                .map(mapSessionToRecentDevice)
                .sort(
                    (left, right) =>
                        new Date(
                            right.lastUsedAt,
                        ).getTime() -
                        new Date(
                            left.lastUsedAt,
                        ).getTime(),
                )
                .slice(0, 3),
    );

    readonly suspiciousActivity =
        computed(
            () =>
                this.periodActivities().find(
                    (activity) =>
                        activity.suspicious,
                ) ?? null,
        );

    readonly suspiciousCount = computed(
        () =>
            this.periodActivities().filter(
                (activity) =>
                    activity.suspicious,
            ).length,
    );

    readonly weeklySummary =
        computed<
            readonly WeeklySummaryItem[]
        >(() => {
            const activities =
                this.periodActivities();

            const loginCount =
                countCategory(
                    activities,
                    'login',
                );

            const securityCount =
                countCategory(
                    activities,
                    'security',
                );

            const deviceCount =
                countCategory(
                    activities,
                    'device',
                );

            const accountCount =
                countCategory(
                    activities,
                    'account',
                );

            const max = Math.max(
                loginCount,
                securityCount,
                deviceCount,
                accountCount,
                1,
            );

            return [
                {
                    id: 'login',
                    label: 'Đăng nhập',
                    count: loginCount,
                    percent:
                        (loginCount / max) * 100,
                    tone: 'purple',
                },
                {
                    id: 'security',
                    label: 'Sự kiện bảo mật',
                    count: securityCount,
                    percent:
                        (securityCount / max) * 100,
                    tone: 'green',
                },
                {
                    id: 'device',
                    label: 'Thiết bị mới',
                    count: deviceCount,
                    percent:
                        (deviceCount / max) * 100,
                    tone: 'orange',
                },
                {
                    id: 'account',
                    label: 'Hoạt động tài khoản',
                    count: accountCount,
                    percent:
                        (accountCount / max) * 100,
                    tone: 'blue',
                },
            ];
        });

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
            events:
                this.api.getSecurityEvents(100),

            sessions:
                this.api
                    .getSessions()
                    .pipe(
                        catchError(() =>
                            of({
                                sessions: [],
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
                    events,
                    sessions,
                }) => {
                    this.eventsState.set(
                        events.events,
                    );

                    this.sessionsState.set(
                        sessions.sessions,
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
        this.resetVisibleCount();
    }

    setCategory(
        category: ActivityCategory,
    ): void {
        this.categoryState.set(category);
        this.resetVisibleCount();
    }

    setPeriodDays(
        period: 7 | 30 | 90,
    ): void {
        this.periodDaysState.set(period);
        this.resetVisibleCount();
    }

    showMore(): void {
        this.visibleCountState.update(
            (current) => current + 10,
        );
    }

    clearError(): void {
        this.errorState.set(null);
    }

    private resetVisibleCount(): void {
        this.visibleCountState.set(
            DEFAULT_VISIBLE_COUNT,
        );
    }
}

function countCategory(
    activities:
        readonly ReturnType<
            typeof mapSecurityEvent
        >[],
    category:
        | 'login'
        | 'security'
        | 'device'
        | 'account',
): number {
    return activities.filter(
        (activity) =>
            activity.category === category,
    ).length;
}

function isSessionActive(
    session: ActivitySessionDto,
): boolean {
    if (session.revokedAt) {
        return false;
    }

    const expiresAt =
        new Date(
            session.expiresAt,
        ).getTime();

    return (
        !Number.isFinite(expiresAt) ||
        expiresAt > Date.now()
    );
}