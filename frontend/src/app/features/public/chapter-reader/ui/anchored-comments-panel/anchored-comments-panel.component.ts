import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { ChapterComment, TextSelectionAnchor } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-anchored-comments-panel',
  standalone: true,
  templateUrl: './anchored-comments-panel.component.html',
  styleUrl: './anchored-comments-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnchoredCommentsPanelComponent {
  readonly blockId = input.required<string>();
  readonly selection = input<TextSelectionAnchor | null>(null);
  readonly comments = input.required<readonly ChapterComment[]>();
  readonly pending = input(false);
  readonly panelClose = output<void>();
  readonly commentCreate = output<{
    readonly body: string;
    readonly anchor: TextSelectionAnchor;
  }>();
  readonly draft = signal('');
  readonly filteredComments = computed(() =>
    this.comments().filter((comment) => comment.anchor?.startBlockId === this.blockId()),
  );

  submitComment(event: Event): void {
    event.preventDefault();
    const anchor = this.selection();
    const body = this.draft().trim();
    if (!anchor || !body || this.pending()) return;
    this.commentCreate.emit({ body, anchor });
    this.draft.set('');
  }
}
