import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingItem } from '../../domain/story-ranking.models';

import { RankMovementComponent } from '../rank-movement/rank-movement.component';

@Component({
    selector:
        'app-ranking-table',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
        RankMovementComponent,
    ],

    templateUrl:
        './ranking-table.component.html',

    styleUrl:
        './ranking-table.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class RankingTableComponent {
    readonly stories =
        input.required<
            readonly StoryRankingItem[]
        >();
}