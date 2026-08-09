import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryUpdateScheduleItem } from '../../domain/story-updates.models';

@Component({
  selector: 'app-update-schedule-card',
  standalone: true,
  imports: [RouterLink, IconComponent, CompactNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './update-schedule-card.component.html',
  styleUrl: './update-schedule-card.component.scss',
})
export class UpdateScheduleCardComponent {
  readonly items = input.required<readonly StoryUpdateScheduleItem[]>();
}
