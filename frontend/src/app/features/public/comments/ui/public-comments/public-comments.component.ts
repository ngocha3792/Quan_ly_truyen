import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../../core/http/reader-engagement-api.model';
import type {
  PublicComment,
  PublicCommentReactionSet,
  PublicCommentReplyCreate,
  PublicCommentReportCreate,
} from '../../domain/public-comment.models';

@Component({
  selector: 'app-public-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-comments.component.html',
  styleUrl: './public-comments.component.scss',
})
export class PublicCommentsComponent {
  readonly comments = input.required<readonly PublicComment[]>();
  readonly title = input('Bình luận');
  readonly totalComments = input<number | null>(null);
  readonly submitting = input(false);
  readonly message = input<string | null>(null);
  readonly emptyMessage = input('Chưa có bình luận nào.');

  readonly commentCreate = output<string>();
  readonly commentUpdate = output<{ readonly id: string; readonly body: string }>();
  readonly commentDelete = output<string>();
  readonly repliesLoad = output<string>();
  readonly replyCreate = output<PublicCommentReplyCreate>();
  readonly reactionSet = output<PublicCommentReactionSet>();
  readonly reportCreate = output<PublicCommentReportCreate>();

  protected readonly reactionTypes: readonly CommentReactionApiType[] = [
    'LIKE',
    'LOVE',
    'LAUGH',
    'INSIGHTFUL',
  ];
  protected readonly reportReasons: readonly CommentReportReasonApi[] = [
    'SPAM',
    'HARASSMENT',
    'HATE_SPEECH',
    'SEXUAL_CONTENT',
    'VIOLENCE',
    'COPYRIGHT',
    'MISINFORMATION',
    'OTHER',
  ];
  protected readonly editingId = signal<string | null>(null);
  protected readonly editBody = signal('');
  protected readonly replyTargetId = signal<string | null>(null);
  protected readonly replyRootId = signal<string | null>(null);
  protected readonly replyBody = signal('');
  protected readonly reportTargetId = signal<string | null>(null);
  protected readonly reportReason = signal<CommentReportReasonApi>('SPAM');
  protected readonly reportDescription = signal('');

  protected submit(textarea: HTMLTextAreaElement): void {
    const body = textarea.value.trim();
    if (!body || this.submitting()) return;
    this.commentCreate.emit(body);
    textarea.value = '';
  }

  protected startEdit(comment: PublicComment): void {
    if (comment.displayState !== 'VISIBLE') return;
    this.editingId.set(comment.id);
    this.editBody.set(comment.content);
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

  protected startReply(rootId: string, parentId: string): void {
    this.replyRootId.set(rootId);
    this.replyTargetId.set(parentId);
    this.replyBody.set('');
  }

  protected submitReply(): void {
    const rootId = this.replyRootId();
    const parentId = this.replyTargetId();
    const body = this.replyBody().trim();
    if (!rootId || !parentId || !body || this.submitting()) return;
    this.replyCreate.emit({ rootId, parentId, body });
    this.cancelReply();
  }

  protected cancelReply(): void {
    this.replyTargetId.set(null);
    this.replyRootId.set(null);
    this.replyBody.set('');
  }

  protected openReport(commentId: string): void {
    this.reportTargetId.set(commentId);
    this.reportReason.set('SPAM');
    this.reportDescription.set('');
  }

  protected closeReport(): void {
    this.reportTargetId.set(null);
    this.reportDescription.set('');
  }

  protected updateReportReason(value: string): void {
    if (this.reportReasons.includes(value as CommentReportReasonApi)) {
      this.reportReason.set(value as CommentReportReasonApi);
    }
  }

  protected submitReport(): void {
    const commentId = this.reportTargetId();
    const reason = this.reportReason();
    const description = this.reportDescription().trim();
    if (!commentId || (reason === 'OTHER' && description.length < 10)) return;
    this.reportCreate.emit({ commentId, reason, description: description || undefined });
    this.closeReport();
  }

  protected reactionLabel(type: CommentReactionApiType): string {
    return { LIKE: '👍', LOVE: '❤️', LAUGH: '😂', INSIGHTFUL: '💡' }[type];
  }

  protected reasonLabel(reason: CommentReportReasonApi): string {
    return {
      SPAM: 'Spam',
      HARASSMENT: 'Quấy rối',
      HATE_SPEECH: 'Nội dung thù ghét',
      SEXUAL_CONTENT: 'Nội dung tình dục',
      VIOLENCE: 'Bạo lực',
      COPYRIGHT: 'Bản quyền',
      MISINFORMATION: 'Thông tin sai lệch',
      OTHER: 'Khác',
    }[reason];
  }
}
