import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ChapterComment } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './chapter-comments.component.html',

  styleUrl: './chapter-comments.component.scss',
})
export class ChapterCommentsComponent {
  @Input({ required: true })
  comments: readonly ChapterComment[] = [];

  @Input()
  totalComments = 0;
}
