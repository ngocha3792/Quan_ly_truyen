import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../shared/components/icon/icon.component';

import {
    GenreTone,
    GenreVisual,
} from '../../domain/genre-discovery.models';

@Component({
    selector: 'app-genre-icon',

    standalone: true,

    imports: [IconComponent],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <span
      class="genre-icon"
      [attr.data-tone]="tone()"
      [class.compact]="compact()"
    >
      <app-icon
        [name]="iconName()"
        [size]="compact() ? 20 : 25"
      />
    </span>
  `,

    styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }

    .genre-icon {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border: 1px solid
        rgba(255, 255, 255, .07);
      border-radius: 50%;
      color: #aeb7c8;
      background:
        rgba(100, 116, 139, .14);
      box-shadow:
        0 10px 24px
        rgba(0, 0, 0, .16);
    }

    .genre-icon.compact {
      width: 39px;
      height: 39px;
      border-radius: 10px;
    }

    .genre-icon[data-tone='red'] {
      color: #ff6b72;
      background:
        rgba(220, 38, 38, .18);
    }

    .genre-icon[data-tone='violet'] {
      color: #a782ff;
      background:
        rgba(109, 40, 217, .2);
    }

    .genre-icon[data-tone='pink'] {
      color: #ff83b8;
      background:
        rgba(219, 39, 119, .18);
    }

    .genre-icon[data-tone='yellow'] {
      color: #f7c94b;
      background:
        rgba(202, 138, 4, .17);
    }

    .genre-icon[data-tone='purple'] {
      color: #c27cff;
      background:
        rgba(126, 34, 206, .18);
    }

    .genre-icon[data-tone='orange'] {
      color: #ff875f;
      background:
        rgba(234, 88, 12, .16);
    }

    .genre-icon[data-tone='blue'] {
      color: #73a8ff;
      background:
        rgba(37, 99, 235, .16);
    }

    .genre-icon[data-tone='cyan'] {
      color: #5fd8ed;
      background:
        rgba(8, 145, 178, .16);
    }

    .genre-icon[data-tone='indigo'] {
      color: #929cff;
      background:
        rgba(79, 70, 229, .17);
    }
  `,
})
export class GenreIconComponent {
    readonly visual =
        input.required<GenreVisual>();

    readonly tone =
        input.required<GenreTone>();

    readonly compact =
        input(false);

    readonly iconName =
        computed<IconName>(() => {
            switch (this.visual()) {
                case 'action':
                    return 'swords';

                case 'fantasy':
                    return 'wand';

                case 'romance':
                    return 'heart';

                case 'comedy':
                    return 'smile';

                case 'manhwa':
                case 'manhua':
                    return 'languages';

                case 'horror':
                    return 'skull';

                case 'drama':
                    return 'masks';

                case 'adventure':
                    return 'compass';

                case 'school-life':
                    return 'graduation-cap';

                case 'sci-fi':
                    return 'rocket';

                case 'isekai':
                    return 'door-open';
            }
        });
}