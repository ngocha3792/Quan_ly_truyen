
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { provideAuthorApplication } from '../../data-access/author-application.providers';
import { AuthorApplicationStore } from '../../data-access/author-application.store';
import {
    AuthorApplicationDraft,
    AuthorApplicationPayload,
} from '../../domain/author-application.models';
import { AuthorApplicationFormComponent } from '../../ui/author-application-form/author-application-form.component';
import { AuthorApplicationSidebarComponent } from '../../ui/author-application-sidebar/author-application-sidebar.component';

@Component({
    selector: 'app-author-application-page',
    standalone: true,

    imports: [
        RouterLink,
        AuthorApplicationFormComponent,
        AuthorApplicationSidebarComponent,
    ],

    providers: [
        ...provideAuthorApplication(),
        AuthorApplicationStore,
    ],

    templateUrl:
        './author-application-page.component.html',

    styleUrl:
        './author-application-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AuthorApplicationPageComponent
    implements OnInit {
    protected readonly store =
        inject(AuthorApplicationStore);

    ngOnInit(): void {
        this.store.load();
    }

    protected handleSaveDraft(
        draft: AuthorApplicationDraft,
    ): void {
        this.store.saveDraft(draft);
    }

    protected handleSubmit(
        payload: AuthorApplicationPayload,
    ): void {
        this.store.submit(payload);
    }
}