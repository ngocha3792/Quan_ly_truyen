import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-revenue-status',
  standalone: true,
  templateUrl: './revenue-status.component.html',
  styleUrl: './revenue-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevenueStatusComponent {
  readonly status = input.required<string>();
  protected readonly labels: Readonly<Record<string, string>> = {
    PENDING: 'Chờ xử lý',
    AVAILABLE: 'Có thể rút',
    RESERVED: 'Đã giữ chỗ',
    PAID: 'Đã trả',
    PROCESSING: 'Đang chi trả',
    COMPLETED: 'Hoàn tất',
    FAILED: 'Thất bại',
    CANCELLED: 'Đã hủy',
  };
}
