import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorStatistics } from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-stats.component.html',

  styleUrl: './author-stats.component.scss',
})
export class AuthorStatsComponent {
  @Input({ required: true })
  statistics!: AuthorStatistics;
}
