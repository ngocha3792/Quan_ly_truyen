import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

import {
    StoryCatalogItem,
    StoryCatalogViewMode,
} from '../../domain/story-catalog.models';

@Component({
    selector:
        'app-story-catalog-card',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
    ],

    templateUrl:
        './story-catalog-card.component.html',

    styleUrl:
        './story-catalog-card.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class StoryCatalogCardComponent {
    readonly story =
        input.required<StoryCatalogItem>();

    readonly viewMode =
        input<StoryCatalogViewMode>(
            'grid',
        );

    protected statusLabel(): string {
        switch (this.story().status) {
            case 'completed':
                return 'Hoàn thành';

            case 'hiatus':
                return 'Tạm ngưng';

            case 'ongoing':
            default:
                return 'Đang tiến hành';
        }
    }
}