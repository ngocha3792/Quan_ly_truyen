import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryUpdateStat } from '../../domain/story-updates.models';

@Component({
  selector: 'app-update-stat-card',
  standalone: true,
  imports: [IconComponent, CompactNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './update-stat-card.component.html',
  styleUrl: './update-stat-card.component.scss',
})
export class UpdateStatCardComponent {
  readonly stat = input.required<StoryUpdateStat>();

  protected readonly iconName = computed<IconName>(() => {
    switch (this.stat().id) {
      case 'updated-stories':
        return 'book-open';
      case 'chapters-today':
        return 'calendar';
      case 'following':
        return 'heart';
      case 'average-speed':
        return 'zap';
    }
  });
}
