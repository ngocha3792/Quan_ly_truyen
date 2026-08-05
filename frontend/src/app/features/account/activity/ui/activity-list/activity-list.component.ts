import { DatePipe } from '@angular/common';

import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { AccountActivityViewModel } from '../../domain/account-activity.models';

import { ActivityEventIconComponent } from '../activity-event-icon/activity-event-icon.component';

@Component({
    selector: 'app-activity-list',

    standalone: true,

    imports: [
        DatePipe,
        RelativeTimePipe,
        IconComponent,
        ActivityEventIconComponent,
    ],

    templateUrl:
        './activity-list.component.html',

    styleUrl:
        './activity-list.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent {
    readonly activities =
        input.required<
            readonly AccountActivityViewModel[]
        >();

    readonly hasMore = input(false);

    readonly loadMoreRequested =
        output<void>();
}