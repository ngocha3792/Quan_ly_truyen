import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';
import { AdminAuthorApplicationStatusBadgeComponent } from './admin-author-application-status-badge.component';

@Component({
  selector: 'app-admin-author-application-review-header',
  standalone: true,
  imports: [AdminAuthorApplicationStatusBadgeComponent],
  templateUrl: './admin-author-application-review-header.component.html',
  styleUrl: './admin-author-application-review-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuthorApplicationReviewHeaderComponent {
  @Input({ required: true }) application!: AdminAuthorApplicationRecord;
  @Input() reviewing = false;
  @Output() readonly approve = new EventEmitter<void>();
  @Output() readonly reject = new EventEmitter<void>();
}
