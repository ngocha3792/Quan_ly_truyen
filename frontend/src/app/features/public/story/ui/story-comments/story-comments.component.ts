import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type {
  PublicCommentReactionSet,
  PublicCommentReplyCreate,
  PublicCommentReportCreate,
} from '../../../comments';
import { PublicCommentsComponent } from '../../../comments';
import type { StoryComment } from '../../domain/story.models';

@Component({
  selector: 'app-story-comments',
  standalone: true,
  imports: [PublicCommentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-comments.component.html',
  styleUrl: './story-comments.component.scss',
})
export class StoryCommentsComponent {
  readonly comments = input.required<readonly StoryComment[]>();
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
