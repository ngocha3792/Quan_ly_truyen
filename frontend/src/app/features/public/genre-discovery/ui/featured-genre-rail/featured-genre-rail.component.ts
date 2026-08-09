import { ChangeDetectionStrategy, Component, ElementRef, input, ViewChild } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { GenreSummary } from '../../domain/genre-discovery.models';

import { FeaturedGenreCardComponent } from '../featured-genre-card/featured-genre-card.component';

@Component({
  selector: 'app-featured-genre-rail',

  standalone: true,

  imports: [IconComponent, FeaturedGenreCardComponent],

  templateUrl: './featured-genre-rail.component.html',

  styleUrl: './featured-genre-rail.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedGenreRailComponent {
  readonly genres = input.required<readonly GenreSummary[]>();

  @ViewChild('rail')
  private readonly rail?: ElementRef<HTMLElement>;

  protected scroll(direction: -1 | 1): void {
    this.rail?.nativeElement.scrollBy({
      left: direction * this.rail.nativeElement.clientWidth * 0.8,

      behavior: 'smooth',
    });
  }
}
