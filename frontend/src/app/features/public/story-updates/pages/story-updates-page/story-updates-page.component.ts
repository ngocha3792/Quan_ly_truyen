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

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';

import { StoryUpdatesStore } from '../../data-access/story-updates.store';

import {
    StoryUpdatesSort,
    StoryUpdatesTab,
} from '../../domain/story-updates.models';

import { FeaturedUpdateCardComponent } from '../../ui/featured-update-card/featured-update-card.component';
import { PopularUpdateGenresComponent } from '../../ui/popular-update-genres/popular-update-genres.component';
import { TopUpdatesCardComponent } from '../../ui/top-updates-card/top-updates-card.component';
import { UpdateFilterBarComponent } from '../../ui/update-filter-bar/update-filter-bar.component';
import { UpdateScheduleCardComponent } from '../../ui/update-schedule-card/update-schedule-card.component';
import { UpdateStatCardComponent } from '../../ui/update-stat-card/update-stat-card.component';
import { UpdateStoryGridComponent } from '../../ui/update-story-grid/update-story-grid.component';

@Component({
    selector:
        'app-story-updates-page',

    standalone: true,

    imports: [
        IconComponent,
        PaginationComponent,

        UpdateStatCardComponent,
        UpdateFilterBarComponent,
        FeaturedUpdateCardComponent,
        UpdateStoryGridComponent,

        TopUpdatesCardComponent,
        UpdateScheduleCardComponent,
        PopularUpdateGenresComponent,
    ],

    templateUrl:
        './story-updates-page.component.html',

    styleUrl:
        './story-updates-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class StoryUpdatesPageComponent {
    private readonly route =
        inject(ActivatedRoute);

    private readonly router =
        inject(Router);

    private readonly destroyRef =
        inject(DestroyRef);

    protected readonly store =
        inject(StoryUpdatesStore);

    constructor() {
        this.route.queryParamMap
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe((params) => {
                this.store.patchQuery({
                    tab:
                        parseUpdateTab(
                            params.get('tab'),
                        ),

                    sort:
                        parseUpdateSort(
                            params.get('sort'),
                        ),

                    page:
                        parsePage(
                            params.get('page'),
                        ),
                });
            });
    }

    protected changeTab(
        tab: StoryUpdatesTab,
    ): void {
        void this.router.navigate([], {
            relativeTo: this.route,

            queryParams: {
                tab,
                page: 1,
            },

            queryParamsHandling: 'merge',
        });
    }

    protected changeSort(
        sort: StoryUpdatesSort,
    ): void {
        void this.router.navigate([], {
            relativeTo: this.route,

            queryParams: {
                sort,
                page: 1,
            },

            queryParamsHandling: 'merge',
        });
    }

    protected changePage(
        page: number,
    ): void {
        void this.router.navigate([], {
            relativeTo: this.route,

            queryParams: {
                page,
            },

            queryParamsHandling: 'merge',
        });
    }
}

function parseUpdateTab(
    value: string | null,
): StoryUpdatesTab {
    switch (value) {
        case 'latest':
        case 'following':
        case 'hot':
        case 'completed':
            return value;

        case 'all':
        default:
            return 'all';
    }
}

function parseUpdateSort(
    value: string | null,
): StoryUpdatesSort {
    switch (value) {
        case 'views':
        case 'title':
            return value;

        case 'latest':
        default:
            return 'latest';
    }
}

function parsePage(
    value: string | null,
): number {
    const page = Number(value);

    return Number.isInteger(page) &&
        page > 0
        ? page
        : 1;
}