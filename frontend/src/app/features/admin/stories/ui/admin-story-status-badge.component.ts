import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const STORY_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

@Component({
  selector: 'app-admin-story-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-story-status-badge.component.html',
  styleUrl: './admin-story-status-badge.component.scss',
})
export class AdminStoryStatusBadgeComponent {
  @Input({ required: true }) status!: string;

  protected get label(): string {
    return STORY_SUBMISSION_STATUS_LABELS[this.status] ?? this.status;
  }
}
