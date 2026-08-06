import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
} from '@angular/core';

import {
    takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
    ActivatedRoute,
    Router,
} from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';

import { StoryRankingStore } from '../../data-access/story-ranking.store';

import {
    StoryRankingMetric,
    StoryRankingPeriod,
} from '../../domain/story-ranking.models';

import { GenreDistributionCardComponent } from '../../ui/genre-distribution-card/genre-distribution-card.component';
import { RankingDiscoveryCardComponent } from '../../ui/ranking-discovery-card/ranking-discovery-card.component';
import { RankingFilterBarComponent } from '../../ui/ranking-filter-bar/ranking-filter-bar.component';
import { RankingPodiumComponent } from '../../ui/ranking-podium/ranking-podium.component';
import { RankingSummaryCardComponent } from '../../ui/ranking-summary-card/ranking-summary-card.component';
import { RankingTableComponent } from '../../ui/ranking-table/ranking-table.component';
import { RankingTrendCardComponent } from '../../ui/ranking-trend-card/ranking-trend-card.component';

@Component({
    selector:
        'app-story-ranking-page',

    standalone: true,

    imports: [
        IconComponent,

        RankingFilterBarComponent,
        RankingPodiumComponent,
        RankingTableComponent,

        RankingSummaryCardComponent,
        GenreDistributionCardComponent,
        RankingTrendCardComponent,
        RankingDiscoveryCardComponent,
    ],

    templateUrl:
        './story-ranking-page.component.html',

    styleUrl:
        './story-ranking-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class StoryRankingPageComponent {
    private readonly route =
        inject(ActivatedRoute);

    private readonly router =
        inject(Router);

    private readonly destroyRef =
        inject(DestroyRef);

    protected readonly store =
        inject(StoryRankingStore);

    constructor() {
        this.route.queryParamMap
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe((params) => {
                this.store.patchQuery({
                    period:
                        parseRankingPeriod(
                            params.get('period'),
                        ),

                    metric:
                        parseRankingMetric(
                            params.get('metric'),
                        ),
                });
            });
    }

    protected changePeriod(
        period: StoryRankingPeriod,
    ): void {
        void this.router.navigate([], {
            relativeTo: this.route,

            queryParams: {
                period,
            },

            queryParamsHandling: 'merge',
        });
    }

    protected changeMetric(
        metric: StoryRankingMetric,
    ): void {
        void this.router.navigate([], {
            relativeTo: this.route,

            queryParams: {
                metric,
            },

            queryParamsHandling: 'merge',
        });
    }
}

function parseRankingPeriod(
    value: string | null,
): StoryRankingPeriod {
    switch (value) {
        case 'day':
        case 'month':
        case 'all':
            return value;

        case 'week':
        default:
            return 'week';
    }
}

function parseRankingMetric(
    value: string | null,
): StoryRankingMetric {
    switch (value) {
        case 'rating':
        case 'followers':
        case 'trending':
            return value;

        case 'popular':
        default:
            return 'popular';
    }
}