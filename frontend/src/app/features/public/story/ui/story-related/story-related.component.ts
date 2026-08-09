import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { RelatedStoryItem } from '../../domain/story.models';

@Component({
  selector: 'app-story-related',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-related.component.html',
  styleUrl: './story-related.component.scss',
})
export class StoryRelatedComponent {
  readonly relatedStories = input.required<readonly RelatedStoryItem[]>();
}
