import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-page-heading',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-heading.component.html',
  styleUrl: './page-heading.component.scss',
})
export class PageHeadingComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly icon = input<IconName | null>(null);
}
