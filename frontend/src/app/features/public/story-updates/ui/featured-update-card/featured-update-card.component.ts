import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { StoryUpdateItem } from '../../domain/story-updates.models';

@Component({
  selector: 'app-featured-update-card',
  standalone: true,
  imports: [RouterLink, IconComponent, CompactNumberPipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './featured-update-card.component.html',
  styleUrl: './featured-update-card.component.scss',
})
export class FeaturedUpdateCardComponent {
  readonly story = input.required<StoryUpdateItem>();
}
