import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';
import { Story } from '../../domain/home.models';

@Component({
  selector: 'app-recommendation-card',
  standalone: true,
  imports: [RouterLink, IconComponent, CompactNumberPipe],
  templateUrl: './recommendation-card.component.html',
  styleUrl: './recommendation-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationCardComponent {
  readonly story = input.required<Story>();
}
