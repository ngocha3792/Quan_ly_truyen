import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import {
  SearchApiClient,
  type SearchFilters,
  type SearchHit,
  type SearchPage,
} from '../../../../core/http/search-api.client';
import { PageHeadingComponent } from '../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PageHeadingComponent, PaginationComponent, IconComponent],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
  private readonly api = inject(SearchApiClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new Subject<void>();
  protected readonly result = signal<SearchPage | null>(null);
  protected readonly filters = signal<SearchFilters>({ categories: [], tags: [] });
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected q = '';
  protected kind = 'story';
  protected category = '';
  protected tag = '';
  protected status = '';
  protected sort = 'relevance';
  protected yearFrom = '';
  protected yearTo = '';
  protected contentRating = '';
  protected featured = false;
  protected storyId = '';
  constructor() {
    this.api
      .filters()
      .pipe(
        catchError(() => of({ categories: [], tags: [] })),
        takeUntilDestroyed(),
      )
      .subscribe((value) => this.filters.set(value));
    combineLatest([this.route.queryParamMap, this.refresh.pipe(startWith(undefined))])
      .pipe(
        map(([params]) => params),
        tap((params) => {
          this.q = params.get('q') ?? '';
          this.kind = params.get('kind') === 'chapter' ? 'chapter' : 'story';
          this.category = params.get('category') ?? '';
          this.tag = params.get('tag') ?? '';
          this.status = params.get('status') ?? '';
          this.sort = params.get('sort') ?? 'relevance';
          this.yearFrom = params.get('yearFrom') ?? '';
          this.yearTo = params.get('yearTo') ?? '';
          this.contentRating = params.get('contentRating') ?? '';
          this.featured = params.get('featured') === 'true';
          this.storyId = params.get('storyId') ?? '';
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap((params) =>
          this.api
            .search({
              ...this.values(),
              page: Math.max(1, Math.min(1000, Number(params.get('page')) || 1)),
            })
            .pipe(
              catchError(() => {
                this.error.set(true);
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.result.set(result);
        this.loading.set(false);
      });
  }
  protected submit(page = 1): void {
    void this.router.navigate(['/tim-kiem'], { queryParams: { ...this.values(), page } });
  }
  protected retry(): void {
    this.refresh.next();
  }
  protected selectKind(kind: string): void {
    this.kind = kind;
    this.submit();
  }
  protected clearFilters(): void {
    this.category = '';
    this.tag = '';
    this.status = '';
    this.sort = 'relevance';
    this.yearFrom = '';
    this.yearTo = '';
    this.contentRating = '';
    this.featured = false;
    this.storyId = '';
    this.submit();
  }
  protected link(hit: SearchHit): string[] {
    return hit.kind === 'chapter'
      ? ['/truyen', hit.storySlug, 'chuong', String(hit.number)]
      : ['/truyen', hit.slug];
  }
  private values() {
    return {
      q: this.q,
      kind: this.kind,
      category: this.category,
      tag: this.tag,
      status: this.status,
      sort: this.sort,
      yearFrom: this.yearFrom,
      yearTo: this.yearTo,
      contentRating: this.contentRating,
      featured: this.featured || undefined,
      storyId: this.kind === 'chapter' ? this.storyId : '',
    };
  }
}
