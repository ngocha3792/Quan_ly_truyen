import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import {
  ChapterDraft,
  ChapterRecoveryEntry,
  ChapterWorkflow,
  ChapterEditorPresence,
} from '../../domain/chapter-editing.models';
import { AuthorManagedChapter } from '../../domain/author-story-management.models';

@Component({
  selector: 'app-chapter-editor-safety',
  standalone: true,
  imports: [DatePipe, ButtonComponent],
  templateUrl: './chapter-editor-safety.component.html',
  styleUrl: './chapter-editor-safety.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterEditorSafetyComponent {
  readonly recoveries = input<readonly ChapterRecoveryEntry[]>([]);
  readonly local = input.required<ChapterDraft>();
  readonly server = input<AuthorManagedChapter | null>(null);
  readonly conflict = input(false);
  readonly busy = input(false);
  readonly workflow = input<ChapterWorkflow | null>(null);
  readonly editors = input<readonly ChapterEditorPresence[]>([]);
  readonly recovered = output<ChapterRecoveryEntry>();
  readonly discarded = output<void>();
  readonly conflictResolved = output<boolean>();
  readonly conflictReloaded = output<void>();
  readonly transitioned = output<'submit-review' | 'reopen'>();
}
