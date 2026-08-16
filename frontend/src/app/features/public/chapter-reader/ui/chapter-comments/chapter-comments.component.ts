import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type {
  PublicCommentReactionSet,
  PublicCommentReplyCreate,
  PublicCommentReportCreate,
} from '../../../comments';
import { PublicCommentsComponent } from '../../../comments';
import type { ChapterComment } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-comments',
  standalone: true,
  imports: [PublicCommentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chapter-comments.component.html',
  styleUrl: './chapter-comments.component.scss',
})
export class ChapterCommentsComponent {
  readonly comments = input.required<readonly ChapterComment[]>();
  readonly totalComments = input(0);
  readonly submitting = input(false);
  readonly message = input<string | null>(null);
  readonly commentCreate = output<string>();
  readonly commentUpdate = output<{ readonly id: string; readonly body: string }>();
  readonly commentDelete = output<string>();
  readonly repliesLoad = output<string>();
  readonly replyCreate = output<PublicCommentReplyCreate>();
  readonly reactionSet = output<PublicCommentReactionSet>();
  readonly reportCreate = output<PublicCommentReportCreate>();
}
