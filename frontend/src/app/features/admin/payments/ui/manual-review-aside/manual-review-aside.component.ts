import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

interface ReviewStep {
  readonly title: string;
  readonly detail: string;
}

@Component({
  selector: 'app-manual-review-aside',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './manual-review-aside.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualReviewAsideComponent {
  /** Lấy từ runtime config, không phải trạng thái tự suy đoán ở client. */
  readonly serviceEnabled = input.required<boolean>();

  protected readonly steps: readonly ReviewStep[] = [
    {
      title: 'Đối chiếu thông tin',
      detail:
        'So tên người gửi và nội dung chuyển khoản trên sao kê ngân hàng với thông tin trong đơn.',
    },
    {
      title: 'Kiểm tra số tiền và thời gian',
      detail: 'Số tiền phải khớp tuyệt đối. Lệch một đồng cũng phải từ chối và yêu cầu gửi lại.',
    },
    {
      title: 'Xác nhận hoặc từ chối',
      detail: 'Nhập lý do rồi xác nhận. Xác nhận sẽ cộng Credit vào ví người gửi ngay lập tức.',
    },
  ];
}
