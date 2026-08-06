
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChapterReaderStore } from '../../data-access/chapter-reader.store';
import { ChapterCommentsComponent } from '../../ui/chapter-comments/chapter-comments.component';
import { ChapterHeadingComponent } from '../../ui/chapter-heading/chapter-heading.component';
import { ChapterSidebarComponent } from '../../ui/chapter-sidebar/chapter-sidebar.component';

@Component({
    selector: 'app-chapter-reader-page',
    standalone: true,

    imports: [
        RouterLink,
        ChapterHeadingComponent,
        ChapterSidebarComponent,
        ChapterCommentsComponent,
    ],

    providers: [
        ChapterReaderStore,
    ],

    templateUrl: './chapter-reader-page.component.html',
    styleUrls: ['./chapter-reader-page.component.scss'],

    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterReaderPageComponent implements OnInit {
    protected readonly store = inject(ChapterReaderStore);

    ngOnInit(): void {
        this.store.load();
    }
}