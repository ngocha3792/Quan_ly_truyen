import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, finalize, Subject } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { AdminTagsApiService } from '../../data-access/admin-tags-api.service';
import { AdminTag, AdminTagList } from '../../domain/admin-tag.models';

@Component({
  selector: 'app-admin-tags-list-page',
  standalone: true,
  imports: [FormsModule, BreadcrumbComponent, PageHeadingComponent, PaginationComponent],
  templateUrl: './admin-tags-list-page.component.html',
  styleUrl: './admin-tags-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTagsListPageComponent implements OnInit {
  private readonly api = inject(AdminTagsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Tag' },
  ];

  readonly result = signal<AdminTagList | null>(null);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly editorOpen = signal(false);
  readonly mergeOpen = signal(false);
  readonly mergeTargets = signal<readonly AdminTag[]>([]);
  readonly searchChanged = new Subject<void>();
  readonly mergeSearchChanged = new Subject<void>();

  q = '';
  page = 1;
  readonly pageSize = 20;
  editingTag: AdminTag | null = null;
  editName = '';
  mergeSource: AdminTag | null = null;
  mergeTargetId = '';
  mergeTargetSearch = '';

  ngOnInit(): void {
    this.searchChanged
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.go(1));
    this.mergeSearchChanged
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadMergeTargets());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.q = params.get('q') ?? '';
      this.page = Math.max(1, Number(params.get('page') ?? 1) || 1);
      this.load();
    });
  }

  go(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.q.trim() || null, page },
    });
  }

  openCreate(): void {
    this.editingTag = null;
    this.editName = '';
    this.editorOpen.set(true);
  }

  openEdit(tag: AdminTag): void {
    this.editingTag = tag;
    this.editName = tag.name;
    this.editorOpen.set(true);
  }

  saveEditor(): void {
    const name = this.editName.trim();
    if (!name || this.mutating()) return;
    this.mutating.set(true);
    this.error.set('');
    const request$ = this.editingTag
      ? this.api.update(this.editingTag.id, name)
      : this.api.create(name);
    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.editorOpen.set(false);
          this.message.set(
            this.editingTag ? 'Đã cập nhật tag. Slug được giữ nguyên.' : 'Đã tạo tag.',
          );
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  delete(tag: AdminTag): void {
    if (tag.storyCount > 0 || this.mutating()) return;
    if (!window.confirm(`Xóa tag "${tag.name}"?`)) return;
    this.mutating.set(true);
    this.api
      .delete(tag.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.message.set(`Đã xóa "${tag.name}".`);
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  openMerge(tag: AdminTag): void {
    this.mergeSource = tag;
    this.mergeTargetId = '';
    this.mergeTargetSearch = '';
    this.mergeOpen.set(true);
    this.loadMergeTargets();
  }

  merge(): void {
    if (!this.mergeSource || !this.mergeTargetId || this.mutating()) return;
    const source = this.mergeSource;
    this.mutating.set(true);
    this.api
      .merge(source.id, this.mergeTargetId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.mergeOpen.set(false);
          this.message.set(
            `Đã hợp nhất "${source.name}" vào "${result.target.name}". ${result.merged.movedStoryCount} liên kết được chuyển, ${result.merged.deduplicatedStoryCount} liên kết trùng được gộp.`,
          );
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({ q: this.q || undefined, page: this.page, pageSize: this.pageSize })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private loadMergeTargets(): void {
    const sourceId = this.mergeSource?.id;
    this.api
      .list({ q: this.mergeTargetSearch.trim() || undefined, page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.mergeTargets.set(result.items.filter((tag) => tag.id !== sourceId)),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
