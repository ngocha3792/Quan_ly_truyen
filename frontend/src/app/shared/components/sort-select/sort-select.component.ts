import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../icon/icon.component';

export interface SortOption<T = string> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'app-sort-select',

  standalone: true,

  imports: [FormsModule, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './sort-select.component.html',

  styleUrl: './sort-select.component.scss',
})
export class SortSelectComponent<T = string> {
  readonly options = input.required<readonly SortOption<T>[]>();

  readonly value = input.required<T>();

  readonly valueChange = output<T>();
}
