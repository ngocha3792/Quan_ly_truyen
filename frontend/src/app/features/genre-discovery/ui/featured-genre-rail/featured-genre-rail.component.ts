import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    input,
    ViewChild,
} from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';

import { GenreSummary } from '../../domain/genre-discovery.models';

import { FeaturedGenreCardComponent } from '../featured-genre-card/featured-genre-card.component';

@Component({
    selector:
        'app-featured-genre-rail',

    standalone: true,

    imports: [
        IconComponent,
        FeaturedGenreCardComponent,
    ],

    template: `
    <section class="featured-section">
      <header>
        <h2>Thể loại nổi bật</h2>
      </header>

      <div class="rail-wrapper">
        <button
          class="rail-button previous"
          type="button"
          aria-label="Cuộn sang trái"
          (click)="scroll(-1)"
        >
          <app-icon
            name="chevron-left"
            [size]="17"
          />
        </button>

        <div
          #rail
          class="featured-rail"
        >
          @for (
            genre of genres();
            track genre.id
          ) {
            <app-featured-genre-card
              [genre]="genre"
            />
          }
        </div>

        <button
          class="rail-button next"
          type="button"
          aria-label="Cuộn sang phải"
          (click)="scroll(1)"
        >
          <app-icon
            name="chevron-right"
            [size]="17"
          />
        </button>
      </div>
    </section>
  `,

    styleUrl:
        './featured-genre-rail.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class FeaturedGenreRailComponent {
    readonly genres =
        input.required<
            readonly GenreSummary[]
        >();

    @ViewChild('rail')
    private readonly rail?:
        ElementRef<HTMLElement>;

    protected scroll(
        direction: -1 | 1,
    ): void {
        this.rail?.nativeElement.scrollBy({
            left:
                direction *
                this.rail.nativeElement
                    .clientWidth *
                0.8,

            behavior: 'smooth',
        });
    }
}