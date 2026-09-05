import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-admin-author-application-approve-dialog',

  standalone: true,

  imports: [ButtonComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-author-application-approve-dialog.component.html',

  styleUrl: './admin-author-application-approve-dialog.component.scss',
})
export class AdminAuthorApplicationApproveDialogComponent {
  readonly penName = input<string | null>(null);

  readonly loading = input(false);

  readonly confirm = output<void>();

  readonly cancel = output<void>(); // eslint-disable-line @angular-eslint/no-output-native -- legacy public output; rename in the Admin refactor wave.

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    this.handleCancel();
  }

  protected handleCancel(): void {
    if (this.loading()) {
      return;
    }

    this.cancel.emit();
  }
}
