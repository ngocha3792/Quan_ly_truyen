import { DatePipe } from '@angular/common';

import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';
import { RelativeTimePipe } from '../../../../../../shared/pipes/relative-time.pipe';

import { AccountSessionViewModel } from '../../domain/account-session.models';

import { SessionDeviceIconComponent } from '../session-device-icon/session-device-icon.component';

@Component({
    selector: 'app-session-list',

    standalone: true,

    imports: [
        DatePipe,
        IconComponent,
        RelativeTimePipe,
        SessionDeviceIconComponent,
    ],

    templateUrl:
        './session-list.component.html',

    styleUrl:
        './session-list.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class SessionListComponent {
    readonly sessions =
        input.required<
            readonly AccountSessionViewModel[]
        >();

    readonly revokingIds =
        input.required<
            ReadonlySet<string>
        >();

    readonly revokeRequested =
        output<AccountSessionViewModel>();
}