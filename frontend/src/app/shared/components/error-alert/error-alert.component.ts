import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-alert.component.html',
  styleUrl: './error-alert.component.scss',
})
export class ErrorAlertComponent {
  readonly title = input('Đã xảy ra lỗi');
  readonly message = input<string | null>(null);
  readonly retryLabel = input('Thử lại');

  readonly retry = output<void>();
}
