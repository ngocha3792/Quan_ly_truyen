
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { provideReadingHistory } from '../../data-access/reading-history.providers';
import { ReadingHistoryStore } from '../../data-access/reading-history.store';
import {
    ReadingHistoryPeriod,
    ReadingHistorySort,
} from '../../domain/reading-history.models';
import { ReadingHistoryListComponent } from '../../ui/reading-history-list/reading-history-list.component';
import { ReadingHistorySidebarComponent } from '../../ui/reading-history-sidebar/reading-history-sidebar.component';
import { ReadingHistoryToolbarComponent } from '../../ui/reading-history-toolbar/reading-history-toolbar.component';

@Component({
    selector: 'app-reading-history-page',
    standalone: true,

    imports: [
        RouterLink,
        ReadingHistoryToolbarComponent,
        ReadingHistoryListComponent,
        ReadingHistorySidebarComponent,
    ],

    providers: [
        ...provideReadingHistory(),
        ReadingHistoryStore,
    ],

    templateUrl:
        './reading-history-page.component.html',

    styleUrls: [
        './reading-history-page.component.scss',
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class ReadingHistoryPageComponent
    implements OnInit {
    protected readonly store =
        inject(ReadingHistoryStore);

    ngOnInit(): void {
        this.store.load();
    }

    protected changePeriod(
        period: ReadingHistoryPeriod,
    ): void {
        this.store.setPeriod(period);
    }

    protected changeSort(
        sort: ReadingHistorySort,
    ): void {
        this.store.setSort(sort);
    }
}