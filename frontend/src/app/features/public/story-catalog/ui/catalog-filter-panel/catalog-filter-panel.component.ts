import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import {
  StoryCatalogAdvancedFilter,
  StoryCatalogFilter,
  StoryCatalogSort,
  StoryGenre,
  StoryPublicationStatus,
} from '../../domain/story-catalog.models';

interface FilterForm {
  genre: FormControl<string>;

  status: FormControl<StoryPublicationStatus | 'all'>;

  sort: FormControl<StoryCatalogSort>;

  yearFrom: FormControl<number | null>;

  yearTo: FormControl<number | null>;
}

@Component({
  selector: 'app-catalog-filter-panel',

  standalone: true,

  imports: [ReactiveFormsModule, IconComponent],

  templateUrl: './catalog-filter-panel.component.html',

  styleUrl: './catalog-filter-panel.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFilterPanelComponent {
  readonly filter = input.required<StoryCatalogFilter>();

  readonly genres = input.required<readonly StoryGenre[]>();

  readonly applied = output<StoryCatalogAdvancedFilter>();

  readonly resetRequested = output<void>();

  protected readonly form = new FormGroup<FilterForm>({
    genre: new FormControl('', {
      nonNullable: true,
    }),

    status: new FormControl('all', {
      nonNullable: true,
    }),

    sort: new FormControl('latest', {
      nonNullable: true,
    }),

    yearFrom: new FormControl<number | null>(null),

    yearTo: new FormControl<number | null>(null),
  });

  constructor() {
    effect(() => {
      const filter = this.filter();

      this.form.reset(
        {
          genre: filter.genre ?? '',

          status: filter.status,

          sort: filter.sort,

          yearFrom: filter.yearFrom,

          yearTo: filter.yearTo,
        },
        {
          emitEvent: false,
        },
      );
    });
  }

  protected submit(): void {
    const value = this.form.getRawValue();

    const yearFrom = normalizeYear(value.yearFrom);

    const yearTo = normalizeYear(value.yearTo);

    this.applied.emit({
      genre: value.genre || null,

      status: value.status,
      sort: value.sort,

      yearFrom: yearFrom !== null && yearTo !== null ? Math.min(yearFrom, yearTo) : yearFrom,

      yearTo: yearFrom !== null && yearTo !== null ? Math.max(yearFrom, yearTo) : yearTo,
    });
  }

  protected reset(): void {
    this.form.reset({
      genre: '',
      status: 'all',
      sort: 'latest',
      yearFrom: null,
      yearTo: null,
    });

    this.resetRequested.emit();
  }
}

function normalizeYear(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(Math.trunc(value), 1900), new Date().getFullYear());
}
