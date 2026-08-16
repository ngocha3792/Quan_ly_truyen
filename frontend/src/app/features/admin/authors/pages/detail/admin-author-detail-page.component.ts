import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS } from '../../../../../core/auth/authorization.models';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminAuthorsApiService } from '../../data-access/admin-authors-api.service';
import type { AdminAuthorDetail, AuthorLifecycleStatus } from '../../domain/admin-author.models';
@Component({
  selector: 'app-admin-author-detail-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-author-detail-page.component.html',
  styleUrl: './admin-author-detail-page.component.scss',
})
export class AdminAuthorDetailPageComponent implements OnInit {
  private readonly api = inject(AdminAuthorsApiService);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = this.route.snapshot.paramMap.get('authorId') ?? '';
  readonly detail = signal<AdminAuthorDetail | null>(null);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly actionOpen = signal(false);
  readonly canManage = computed(
    () =>
      this.auth
        .user()
        ?.permissions.some((p) => p.toLowerCase() === AUTH_PERMISSIONS.AUTHOR_STATUS_MANAGE) ??
      false,
  );
  pendingStatus: AuthorLifecycleStatus = 'SUSPENDED';
  reason = '';
  ngOnInit(): void {
    this.load();
  }
  openAction(status: AuthorLifecycleStatus): void {
    this.pendingStatus = status;
    this.reason = '';
    this.actionOpen.set(true);
  }
  confirmAction(): void {
    const reason = this.reason.trim();
    if (reason.length < 10) return;
    this.change(this.pendingStatus, reason);
  }
  reactivate(): void {
    if (window.confirm('Kích hoạt lại capability tác giả?')) this.change('ACTIVE');
  }
  private change(status: AuthorLifecycleStatus, reason?: string): void {
    this.mutating.set(true);
    this.error.set('');
    this.api
      .changeStatus(this.id, status, reason)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: () => {
          this.actionOpen.set(false);
          this.message.set(`Đã cập nhật author thành ${status}.`);
          this.load();
        },
        error: (e: unknown) => this.error.set(getApiErrorMessage(e)),
      });
  }
  private load(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.api
      .detail(this.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (d) => this.detail.set(d),
        error: (e: unknown) => this.error.set(getApiErrorMessage(e)),
      });
  }
}
