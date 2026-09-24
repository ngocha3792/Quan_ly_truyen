import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AiBarRow } from '../domain/ai-usage.metrics';

/**
 * Danh sách thanh ngang cho một chuỗi số liệu duy nhất (magnitude), nên dùng
 * một tông màu thay vì bảng màu categorical.
 */
@Component({
  selector: 'app-ai-bar-list',
  standalone: true,
  templateUrl: './ai-bar-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiBarListComponent {
  readonly rows = input.required<readonly AiBarRow[]>();
  readonly emptyMessage = input('Chưa có dữ liệu trong khoảng thời gian này.');
}
