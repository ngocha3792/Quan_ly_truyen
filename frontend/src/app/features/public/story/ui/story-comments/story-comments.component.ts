import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
}
