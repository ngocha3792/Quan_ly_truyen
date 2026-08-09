import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconName } from './icon.models';

export type { IconName } from './icon.models';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.8);
}
