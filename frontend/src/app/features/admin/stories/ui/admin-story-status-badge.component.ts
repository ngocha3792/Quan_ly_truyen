import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
@Component({
  selector: 'app-admin-story-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-story-status-badge.component.html',
  styleUrl: './admin-story-status-badge.component.scss',
})
export class AdminStoryStatusBadgeComponent {
  @Input({ required: true }) status!: string;
}
