import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { StoryUpdateItem } from '../../domain/story-updates.models';

@Component({
  selector: 'app-update-story-card',
  standalone: true,
  imports: [RouterLink, IconComponent, CompactNumberPipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './update-story-card.component.html',
  styleUrl: './update-story-card.component.scss',
})
export class UpdateStoryCardComponent {
  readonly story = input.required<StoryUpdateItem>();
}
