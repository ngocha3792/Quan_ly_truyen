import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

import { ReadingHistoryItem } from '../../domain/reading-history.models';

@Component({
  selector: 'app-reading-history-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './reading-history-list.component.html',

  styleUrl: './reading-history-list.component.scss',
})
export class ReadingHistoryListComponent {
  @Input({ required: true })
  items: readonly ReadingHistoryItem[] = [];

  @Input()
  bookmarkPendingChapterIds: readonly string[] = [];

  @Output()
  readonly bookmarkToggle = new EventEmitter<string>();
}
