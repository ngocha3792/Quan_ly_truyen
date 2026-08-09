import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-search-field',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './search-field.component.html',

  styleUrl: './search-field.component.scss',
})
export class SearchFieldComponent {
  readonly value = input('');

  readonly placeholder = input('Tìm kiếm...');

  readonly ariaLabel = input('');

  readonly disabled = input(false);

  readonly iconSize = input(17);

  readonly valueChange = output<string>();

  protected handleInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;

    this.valueChange.emit(inputElement.value);
  }
}
