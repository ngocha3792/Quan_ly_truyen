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
import { AdminCategoriesApiService } from '../../data-access/admin-categories-api.service';
import { AdminCategory, AdminCategoryList } from '../../domain/admin-category.models';

@Component({
  selector: 'app-admin-categories-list-page',
  standalone: true,
  imports: [FormsModule, BreadcrumbComponent, PageHeadingComponent, PaginationComponent],
  templateUrl: './admin-categories-list-page.component.html',
  styleUrl: './admin-categories-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCategoriesListPageComponent implements OnInit {
  private readonly api = inject(AdminCategoriesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Thể loại' },
  ];

  readonly result = signal<AdminCategoryList | null>(null);
  readonly parentOptions = signal<readonly AdminCategory[]>([]);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly editorOpen = signal(false);
  readonly searchChanged = new Subject<void>();

  q = '';
  status: '' | 'active' | 'inactive' = '';
  parentFilter = '';
  page = 1;
  readonly pageSize = 20;
  editing: AdminCategory | null = null;
  editName = '';
  editDescription = '';
  editParentId = '';
  editSortOrder = 0;
  editActive = true;

  ngOnInit(): void {
    this.searchChanged
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.go(1));
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.q = params.get('q') ?? '';
      this.status = (params.get('status') as '' | 'active' | 'inactive' | null) ?? '';
      this.parentFilter = params.get('parentId') ?? '';
      this.page = Math.max(1, Number(params.get('page') ?? 1) || 1);
      this.load();
      if (this.parentOptions().length === 0) this.loadParentOptions();
    });
  }

  applyFilters(): void {
    this.go(1);
  }
  go(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.q.trim() || null,
        status: this.status || null,
        parentId: this.parentFilter || null,
        page,
      },
    });
  }

  openCreate(): void {
    this.editing = null;
    this.editName = '';
    this.editDescription = '';
    this.editParentId = '';
    this.editSortOrder = 0;
    this.editActive = true;
    this.loadParentOptions();
    this.editorOpen.set(true);
  }

  openEdit(category: AdminCategory): void {
    this.editing = category;
    this.editName = category.name;
    this.editDescription = category.description ?? '';
    this.editParentId = category.parentId ?? '';
    this.editSortOrder = category.sortOrder;
    this.editActive = category.isActive;
    this.loadParentOptions();
    this.editorOpen.set(true);
  }

  saveEditor(): void {
    const name = this.editName.trim();
    if (!name || this.mutating()) return;
    const payload = {
      name,
      description: this.editDescription.trim() || null,
      parentId: this.editParentId || null,
      sortOrder: this.editSortOrder,
      isActive: this.editActive,
    };
    this.mutating.set(true);
    this.error.set('');
    const request$ = this.editing
      ? this.api.update(this.editing.id, payload)
      : this.api.create(payload);
    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.editorOpen.set(false);
          this.message.set(
            this.editing ? 'Đã cập nhật thể loại. Slug được giữ nguyên.' : 'Đã tạo thể loại.',
          );
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  toggleActive(category: AdminCategory): void {
    if (this.mutating()) return;
    const next = !category.isActive;
    const detail =
      !next && category.storyCount > 0
        ? `\n\n${category.storyCount} truyện hiện tại vẫn giữ liên kết; tác giả sẽ không thể gán thể loại này cho truyện mới.`
        : '';
    if (
      !window.confirm(`${next ? 'Kích hoạt lại' : 'Ngừng hoạt động'} "${category.name}"?${detail}`)
    )
      return;
    this.mutating.set(true);
    this.api
      .update(category.id, { isActive: next })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.message.set(
            next
              ? 'Đã kích hoạt thể loại.'
              : 'Đã ngừng hoạt động thể loại; liên kết truyện cũ được giữ nguyên.',
          );
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  delete(category: AdminCategory): void {
    if (category.storyCount > 0 || category.childCount > 0 || this.mutating()) return;
    if (!window.confirm(`Xóa thể loại "${category.name}"?`)) return;
    this.mutating.set(true);
    this.api
      .delete(category.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.message.set(`Đã xóa "${category.name}".`);
          this.load();
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({
        q: this.q || undefined,
        isActive: this.status ? this.status === 'active' : undefined,
        parentId: this.parentFilter || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private loadParentOptions(): void {
    this.api
      .list({ page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) =>
          this.parentOptions.set(
            result.items.filter((category) => category.id !== this.editing?.id),
          ),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
