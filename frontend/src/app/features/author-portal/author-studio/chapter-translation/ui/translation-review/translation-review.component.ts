import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { NoticeComponent } from '../../../../../../shared/components/notice/notice.component';
import {
  ChapterTranslation,
  TranslationReviewInput,
} from '../../domain/chapter-translation.models';

@Component({
  selector: 'app-translation-review',
  standalone: true,
  imports: [FormsModule, ButtonComponent, NoticeComponent],
  templateUrl: './translation-review.component.html',
  styleUrl: './translation-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranslationReviewComponent {
  readonly translation = input.required<ChapterTranslation>();
  readonly currentVersion = input<number | null>(null);
  readonly blocked = input(false);
  readonly busy = input(false);
  readonly reviewed = output<TranslationReviewInput>();
  protected title = '';
  protected content = '';
  protected notes = '';
  private loadedKey = '';
  protected readonly stale = computed(
    () =>
      this.translation().sourceVersion !== null &&
      this.translation().sourceVersion !== this.currentVersion(),
  );
  protected readonly editable = computed(
    () =>
      this.translation().status === 'COMPLETED' && this.translation().reviewStatus === 'PENDING',
  );
  constructor() {
    effect(() => {
      const result = this.translation();
      const key = `${result.id}:${result.generation}:${result.reviewStatus}`;
      if (this.loadedKey === key) return;
      this.loadedKey = key;
      this.title = result.translatedTitle ?? '';
      this.content = result.translatedContent ?? '';
      this.notes = result.revisionNotes ?? '';
    });
  }
  protected review(decision: TranslationReviewInput['decision']): void {
    if (this.busy() || !this.editable()) return;
    if (
      decision === 'APPROVE' &&
      (this.blocked() || this.stale() || !this.title.trim() || !this.content.trim())
    )
      return;
    if (decision !== 'APPROVE' && !this.notes.trim()) return;
    this.reviewed.emit({
      decision,
      ...(this.notes.trim() ? { notes: this.notes.trim() } : {}),
      ...(decision === 'APPROVE'
        ? { translatedTitle: this.title.trim(), translatedContent: this.content }
        : {}),
    });
  }
}
