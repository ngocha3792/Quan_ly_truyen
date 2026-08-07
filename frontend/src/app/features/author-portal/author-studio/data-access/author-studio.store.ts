
import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';
import {
    takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
    AuthorStudioDashboard,
    AuthorStudioPeriod,
} from '../domain/author-studio.models';
import {
    AuthorStudioRepository,
} from '../domain/author-studio.repository';

export type AuthorStudioLoadStatus =
    | 'idle'
    | 'loading'
    | 'success'
    | 'error';

@Injectable()
export class AuthorStudioStore {
    private readonly repository =
        inject(AuthorStudioRepository);

    private readonly destroyRef =
        inject(DestroyRef);

    private readonly dashboardState =
        signal<AuthorStudioDashboard | null>(
            null,
        );

    readonly dashboard =
        this.dashboardState.asReadonly();

    readonly status =
        signal<AuthorStudioLoadStatus>('idle');

    readonly errorMessage =
        signal('');

    readonly selectedPeriod =
        signal<AuthorStudioPeriod>('30d');

    readonly readershipPoints = computed(
        () => {
            const dashboard =
                this.dashboardState();

            if (!dashboard) {
                return [];
            }

            return dashboard.readership[
                this.selectedPeriod()
            ];
        },
    );

    load(): void {
        if (this.status() === 'loading') {
            return;
        }

        this.status.set('loading');
        this.errorMessage.set('');

        this.repository
            .getDashboard()
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe({
                next: (dashboard) => {
                    this.dashboardState.set(
                        dashboard,
                    );

                    this.status.set('success');
                },

                error: () => {
                    this.status.set('error');

                    this.errorMessage.set(
                        'Không thể tải dữ liệu Author Studio.',
                    );
                },
            });
    }

    setPeriod(
        period: AuthorStudioPeriod,
    ): void {
        this.selectedPeriod.set(period);
    }
}