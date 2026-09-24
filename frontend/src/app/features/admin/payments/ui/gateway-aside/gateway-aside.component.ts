import { ChangeDetectionStrategy, Component } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-gateway-aside',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './gateway-aside.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GatewayAsideComponent {
  protected readonly steps: readonly { title: string; detail: string }[] = [
    {
      title: 'Đối soát với cổng',
      detail:
        'Hỏi lại cổng thanh toán trạng thái thật của giao dịch rồi so với trạng thái đang lưu.',
    },
    {
      title: 'Xử lý chênh lệch',
      detail: 'Cổng báo đã thu mà hệ thống chưa ghi nhận thì đối soát sẽ tự cộng Credit còn thiếu.',
    },
    {
      title: 'Hoàn tiền',
      detail:
        'Credit bị giữ lại ngay khi tạo lệnh. Hoàn thất bại thì Credit được trả về ví người dùng.',
    },
    {
      title: 'Lưu vết',
      detail: 'Mọi thao tác ghi vào nhật ký audit kèm lý do và tài khoản thực hiện.',
    },
  ];
}
