import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryCatalogStore } from '../../data-access/story-catalog.store';

import { CatalogFilterPanelComponent } from '../../ui/catalog-filter-panel/catalog-filter-panel.component';
import { CatalogQuickFiltersComponent } from '../../ui/catalog-quick-filters/catalog-quick-filters.component';
import { CatalogRankingComponent } from '../../ui/catalog-ranking/catalog-ranking.component';
import { CatalogToolbarComponent } from '../../ui/catalog-toolbar/catalog-toolbar.component';
import { StoryCatalogGridComponent } from '../../ui/story-catalog-grid/story-catalog-grid.component';

@Component({
    selector:
        'app-story-catalog-page',

    standalone: true,

    imports: [
        RouterLink,
        CompactNumberPipe,
        PaginationComponent,

        CatalogToolbarComponent,
        CatalogQuickFiltersComponent,
        StoryCatalogGridComponent,
        CatalogFilterPanelComponent,
        CatalogRankingComponent,
    ],

    templateUrl:
        './story-catalog-page.component.html',

    styleUrl:
        './story-catalog-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class StoryCatalogPageComponent {
    protected readonly store =
        inject(StoryCatalogStore);
}