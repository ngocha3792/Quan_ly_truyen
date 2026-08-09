import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './empty-state.component.html',

  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly icon = input<IconName | null>(null);

  readonly iconSize = input(30);

  readonly title = input.required<string>();

  readonly description = input('');
}
