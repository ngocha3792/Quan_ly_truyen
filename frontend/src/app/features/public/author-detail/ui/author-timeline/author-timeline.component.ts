import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorTimelineItem } from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-timeline.component.html',

  styleUrl: './author-timeline.component.scss',
})
export class AuthorTimelineComponent {
  @Input({ required: true })
  timeline: readonly AuthorTimelineItem[] = [];
}
