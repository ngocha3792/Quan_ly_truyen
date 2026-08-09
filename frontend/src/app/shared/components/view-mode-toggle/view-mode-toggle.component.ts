import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

export type SharedViewMode = 'grid' | 'list';

@Component({
  selector: 'app-view-mode-toggle',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './view-mode-toggle.component.html',

  styleUrl: './view-mode-toggle.component.scss',
})
export class ViewModeToggleComponent {
  readonly value = input.required<SharedViewMode>();

  readonly ariaLabel = input('Kiểu hiển thị');

  readonly iconSize = input(18);

  readonly valueChange = output<SharedViewMode>();

  protected select(value: SharedViewMode): void {
    if (value !== this.value()) {
      this.valueChange.emit(value);
    }
  }
}
