import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  AuthorHotWork,
  AuthorRecentUpdate,
  AuthorStatistics,
} from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-sidebar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-sidebar.component.html',

  styleUrl: './author-sidebar.component.scss',
})
export class AuthorSidebarComponent {
  @Input({ required: true })
  statistics!: AuthorStatistics;

  @Input()
  joinedAt = '';

  @Input({ required: true })
  recentUpdates: readonly AuthorRecentUpdate[] = [];

  @Input({ required: true })
  hotWorks: readonly AuthorHotWork[] = [];
}
