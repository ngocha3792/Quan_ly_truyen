import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ChapterComment } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chapter-comments.component.html',
  styleUrl: './chapter-comments.component.scss',
})
export class ChapterCommentsComponent {
  readonly comments = input.required<readonly ChapterComment[]>();
  readonly totalComments = input(0);
  readonly submitting = input(false);
  readonly commentCreate = output<string>();
  readonly commentUpdate = output<{ readonly id: string; readonly body: string }>();
  readonly commentDelete = output<string>();

  protected readonly editingId = signal<string | null>(null);
  protected readonly editBody = signal('');

  protected submit(input: HTMLInputElement): void {
    const body = input.value.trim();
    if (!body || this.submitting()) return;
    this.commentCreate.emit(body);
    input.value = '';
  }

  protected startEdit(comment: ChapterComment): void {
    this.editingId.set(comment.id);
    this.editBody.set(comment.content);
  }

  protected updateEdit(value: string): void {
    this.editBody.set(value);
  }

  protected saveEdit(commentId: string): void {
    const body = this.editBody().trim();
    if (!body) return;
    this.commentUpdate.emit({ id: commentId, body });
    this.cancelEdit();
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editBody.set('');
  }
}
