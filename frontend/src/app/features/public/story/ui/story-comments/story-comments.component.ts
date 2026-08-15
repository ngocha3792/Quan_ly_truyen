import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { StoryComment } from '../../domain/story.models';

@Component({
  selector: 'app-story-comments',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-comments.component.html',
  styleUrl: './story-comments.component.scss',
})
export class StoryCommentsComponent {
  readonly comments = input.required<readonly StoryComment[]>();
  readonly submitting = input(false);
  readonly commentCreate = output<string>();
  readonly commentUpdate = output<{ readonly id: string; readonly body: string }>();
  readonly commentDelete = output<string>();

  protected readonly editingId = signal<string | null>(null);
  protected readonly editBody = signal('');

  protected submit(textarea: HTMLTextAreaElement): void {
    const body = textarea.value.trim();
    if (!body || this.submitting()) return;
    this.commentCreate.emit(body);
    textarea.value = '';
  }

  protected startEdit(comment: StoryComment): void {
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
    this.editingId.set(null);
    this.editBody.set('');
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editBody.set('');
  }
}
