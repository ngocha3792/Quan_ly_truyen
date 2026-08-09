import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ContinueReadingItem, ReadingHistoryStatistics } from '../../domain/reading-history.models';
import type { ReadingHistorySyncState } from '../../domain/reading-history.models';

@Component({
  selector: 'app-reading-history-sidebar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reading-history-sidebar.component.html',

  styleUrl: './reading-history-sidebar.component.scss',
})
export class ReadingHistorySidebarComponent {
  @Input({ required: true })
  statistics!: ReadingHistoryStatistics;

  @Input({ required: true })
  continueReading: readonly ContinueReadingItem[] = [];

  @Input()
  syncState: ReadingHistorySyncState = 'idle';

  @Output()
  readonly clearHistory = new EventEmitter<void>();

  @Output()
  readonly syncDevices = new EventEmitter<void>();
}
