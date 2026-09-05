import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-dialog-shell',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './dialog-shell.component.html',

  styleUrl: './dialog-shell.component.scss',
})
export class DialogShellComponent {
  readonly open = input(false);

  readonly busy = input(false);

  readonly title = input('');

  readonly eyebrow = input('');

  readonly dialogTitleId = input('dialog-shell-title');

  readonly ariaLabel = input('Hộp thoại');

  readonly showHeader = input(true);

  readonly maxWidth = input('510px');

  readonly closed = output<void>();

  protected requestClose(): void {
    if (this.busy()) {
      return;
    }

    this.closed.emit();
  }
}
