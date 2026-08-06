
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { provideAuthorDirectory } from '../../data-access/author-directory.providers';
import { AuthorDirectoryStore } from '../../data-access/author-directory.store';
import { AuthorDirectorySort } from '../../domain/author-directory.models';
import { AuthorDirectorySidebarComponent } from '../../ui/author-directory-sidebar/author-directory-sidebar.component';
import { AuthorDirectoryToolbarComponent } from '../../ui/author-directory-toolbar/author-directory-toolbar.component';
import { AuthorListComponent } from '../../ui/author-list/author-list.component';

@Component({
    selector: 'app-author-directory-page',
    standalone: true,

    imports: [
        RouterLink,
        AuthorDirectoryToolbarComponent,
        AuthorListComponent,
        AuthorDirectorySidebarComponent,
    ],

    providers: [
        ...provideAuthorDirectory(),
        AuthorDirectoryStore,
    ],

    templateUrl:
        './author-directory-page.component.html',

    styleUrls: [
        './author-directory-page.component.scss',
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AuthorDirectoryPageComponent
    implements OnInit {
    protected readonly store =
        inject(AuthorDirectoryStore);

    ngOnInit(): void {
        this.store.load();
    }

    protected handleSortChange(
        sort: AuthorDirectorySort,
    ): void {
        this.store.setSort(sort);
    }
}