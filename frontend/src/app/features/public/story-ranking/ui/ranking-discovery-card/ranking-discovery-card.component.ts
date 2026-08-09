import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-ranking-discovery-card',

  standalone: true,

  imports: [RouterLink, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './ranking-discovery-card.component.html',

  styleUrl: './ranking-discovery-card.component.scss',
})
export class RankingDiscoveryCardComponent {}
