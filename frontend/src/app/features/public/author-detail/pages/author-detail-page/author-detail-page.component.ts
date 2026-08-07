
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import {
    ActivatedRoute,
    RouterLink,
} from '@angular/router';

import {
    provideAuthorDetail,
} from '../../data-access/author-detail.providers';
import {
    AuthorDetailStore,
} from '../../data-access/author-detail.store';
import {
    AuthorBiographyComponent,
} from '../../ui/author-biography/author-biography.component';
import {
    AuthorHeroComponent,
} from '../../ui/author-hero/author-hero.component';
import {
    AuthorSidebarComponent,
} from '../../ui/author-sidebar/author-sidebar.component';
import {
    AuthorStatsComponent,
} from '../../ui/author-stats/author-stats.component';
import {
    AuthorTimelineComponent,
} from '../../ui/author-timeline/author-timeline.component';
import {
    AuthorWorksComponent,
} from '../../ui/author-works/author-works.component';

@Component({
    selector: 'app-author-detail-page',
    standalone: true,

    imports: [
        RouterLink,
        AuthorHeroComponent,
        AuthorStatsComponent,
        AuthorBiographyComponent,
        AuthorWorksComponent,
        AuthorTimelineComponent,
        AuthorSidebarComponent,
    ],

    providers: [
        ...provideAuthorDetail(),
        AuthorDetailStore,
    ],

    templateUrl: './author-detail-page.component.html',
    styleUrls: ['./author-detail-page.component.scss'],

    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);

    protected readonly store = inject(AuthorDetailStore);

    ngOnInit(): void {
        const slug =
            this.route.snapshot.paramMap.get('authorSlug')
            ?? 'nhi-can';

        this.store.load(slug);
    }
}