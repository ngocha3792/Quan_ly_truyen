import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import {
  AuthorChapterVersion,
  AuthorChapterVersionSummary,
} from '../../domain/author-story-management.models';
import { ChapterVersionDiff } from '../../domain/chapter-editing.models';

@Component({
  selector: 'app-chapter-version-history',
  standalone: true,
  imports: [DatePipe, ButtonComponent],
  templateUrl: './chapter-version-history.component.html',
  styleUrl: './chapter-version-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterVersionHistoryComponent {
  readonly versions = input<readonly AuthorChapterVersionSummary[]>([]);
  readonly total = input(0);
  readonly currentVersion = input(0);
  readonly selected = input<AuthorChapterVersion | null>(null);
  readonly diff = input<ChapterVersionDiff | null>(null);
  readonly loading = input(false);
  readonly busy = input(false);
  readonly canRestore = input(false);
  readonly includeAutosaves = input(false);
  readonly viewed = output<number>();
  readonly restored = output<number>();
  readonly compared = output<number>();
  readonly loadMore = output<void>();
  readonly autosavesChanged = output<boolean>();
  readonly closed = output<void>();
}
