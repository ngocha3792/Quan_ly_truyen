import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';

@Component({
  selector: 'app-admin-author-application-summary',
  standalone: true,
  templateUrl: './admin-author-application-summary.component.html',
  styleUrl: './admin-author-application-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuthorApplicationSummaryComponent {
  @Input({ required: true }) application!: AdminAuthorApplicationRecord;
  protected text(value: string | null | undefined): string {
    return value?.trim() || '—';
  }
  protected date(value: string | null): string {
    return value ? new Date(value).toLocaleString('vi-VN') : '—';
  }
  protected fileSize(value: string | null): string {
    const bytes = Number(value);
    if (!value || !Number.isFinite(bytes) || bytes < 0) return 'Không rõ kích thước';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
}
