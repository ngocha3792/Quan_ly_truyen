import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabFilterOption<T = string> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'app-tab-filter',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './tab-filter.component.html',

  styleUrl: './tab-filter.component.scss',
})
export class TabFilterComponent<T = string> {
  readonly options = input.required<readonly TabFilterOption<T>[]>();

  readonly selected = input.required<T>();

  readonly ariaLabel = input('Bộ lọc');

  readonly selectedChange = output<T>();
}
