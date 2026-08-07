import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
} from '@angular/core';

import {
    takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
    ActivatedRoute,
    Router,
    RouterLink,
} from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { GenreDiscoveryStore } from '../../data-access/genre-discovery.store';

import { FeaturedGenreRailComponent } from '../../ui/featured-genre-rail/featured-genre-rail.component';
import { GenreGridComponent } from '../../ui/genre-grid/genre-grid.component';
import { GenreQuickFilterComponent } from '../../ui/genre-quick-filter/genre-quick-filter.component';
import { GenreRankingCardComponent } from '../../ui/genre-ranking-card/genre-ranking-card.component';
import { GenreRecommendationCardComponent } from '../../ui/genre-recommendation-card/genre-recommendation-card.component';
import { GenreTrendingCardComponent } from '../../ui/genre-trending-card/genre-trending-card.component';

@Component({
    selector:
        'app-genre-discovery-page',

    standalone: true,

    imports: [
        IconComponent,
        RouterLink,

        GenreQuickFilterComponent,
        FeaturedGenreRailComponent,
        GenreGridComponent,
        GenreRankingCardComponent,
        GenreTrendingCardComponent,
        GenreRecommendationCardComponent,
    ],

    templateUrl:
        './genre-discovery-page.component.html',

    styleUrl:
        './genre-discovery-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class GenreDiscoveryPageComponent
    implements OnInit {
    private readonly router =
        inject(Router);

    private readonly route =
        inject(ActivatedRoute);

    private readonly destroyRef =
        inject(DestroyRef);

    protected readonly store =
        inject(GenreDiscoveryStore);

    ngOnInit(): void {
        this.route.queryParamMap
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe((params) => {
                this.store.selectGenre(
                    params.get('genre'),
                );
            });

        this.store.load();
    }

    protected selectGenre(
        slug: string | null,
    ): void {
        this.store.selectGenre(slug);

        void this.router.navigate([], {
            relativeTo: this.route,

            queryParams: {
                genre: slug,
            },

            queryParamsHandling: 'merge',

            replaceUrl: true,
        });
    }

    protected exploreRandom(): void {
        const genre =
            this.store.randomGenre();

        if (!genre) {
            return;
        }

        void this.router.navigate(
            ['/danh-sach'],
            {
                queryParams: {
                    genre: genre.slug,
                    sort: 'popular',
                },
            },
        );
    }
}