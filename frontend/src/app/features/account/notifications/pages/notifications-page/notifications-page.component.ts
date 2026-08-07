
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { provideNotifications } from '../../data-access/notifications.providers';
import { NotificationsStore } from '../../data-access/notifications.store';
import { NotificationCategory } from '../../domain/notifications.models';
import { NotificationsListComponent } from '../../ui/notifications-list/notifications-list.component';
import { NotificationsSidebarComponent } from '../../ui/notifications-sidebar/notifications-sidebar.component';
import { NotificationsToolbarComponent } from '../../ui/notifications-toolbar/notifications-toolbar.component';

@Component({
    selector: 'app-notifications-page',
    standalone: true,

    imports: [
        RouterLink,
        NotificationsToolbarComponent,
        NotificationsListComponent,
        NotificationsSidebarComponent,
    ],

    providers: [
        ...provideNotifications(),
        NotificationsStore,
    ],

    templateUrl:
        './notifications-page.component.html',

    styleUrls: [
        './notifications-page.component.scss',
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent
    implements OnInit {
    protected readonly store =
        inject(NotificationsStore);

    ngOnInit(): void {
        this.store.load();
    }

    protected changeCategory(
        category: NotificationCategory,
    ): void {
        this.store.setCategory(category);
    }
}