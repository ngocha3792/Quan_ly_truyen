import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

export type StatCardTone = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'indigo';

@Component({
  selector: 'app-stat-card',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './stat-card.component.html',

  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  readonly label = input.required<string>();

  readonly value = input.required<string | number>();

  readonly description = input('');

  readonly icon = input.required<IconName>();

  readonly iconSize = input(24);

  readonly tone = input<StatCardTone>('purple');
}
