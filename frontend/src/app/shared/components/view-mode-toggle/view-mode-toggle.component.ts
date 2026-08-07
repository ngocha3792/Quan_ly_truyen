import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

export type SharedViewMode = 'grid' | 'list';

@Component({
  selector: 'app-view-mode-toggle',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="view-mode-toggle" role="group" [attr.aria-label]="ariaLabel()">
      <button
        type="button"
        aria-label="Hiển thị dạng lưới"
        [class.active]="value() === 'grid'"
        [attr.aria-pressed]="value() === 'grid'"
        (click)="select('grid')"
      >
        <app-icon name="grid" [size]="iconSize()" />
      </button>

      <button
        type="button"
        aria-label="Hiển thị dạng danh sách"
        [class.active]="value() === 'list'"
        [attr.aria-pressed]="value() === 'list'"
        (click)="select('list')"
      >
        <app-icon name="menu" [size]="iconSize()" />
      </button>
    </div>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .view-mode-toggle {
      min-height: var(--view-toggle-min-height, 43px);

      display: grid;

      grid-template-columns: repeat(2, minmax(0, 1fr));

      gap: var(--view-toggle-gap, 4px);

      padding: var(--view-toggle-padding, 4px);

      border: var(--view-toggle-border, 1px solid rgba(132, 145, 177, 0.18));

      border-radius: var(--view-toggle-radius, 8px);

      background: var(--view-toggle-background, rgba(5, 10, 21, 0.46));
    }

    button {
      min-width: var(--view-toggle-button-width, 36px);

      min-height: var(--view-toggle-button-height, 35px);

      display: grid;

      place-items: center;

      border: 0;

      border-radius: var(--view-toggle-button-radius, 6px);

      color: var(--view-toggle-color, #697388);

      background: transparent;

      cursor: pointer;

      transition:
        color 160ms ease,
        background 160ms ease;
    }

    button:hover {
      color: var(--view-toggle-hover-color, #d8d5df);
    }

    button.active {
      color: var(--view-toggle-active-color, #c181ff);

      background: var(--view-toggle-active-background, rgba(125, 61, 204, 0.17));

      box-shadow: var(--view-toggle-active-shadow, none);
    }
  `,
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
