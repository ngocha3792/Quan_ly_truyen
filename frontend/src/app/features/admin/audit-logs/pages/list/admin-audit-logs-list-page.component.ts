import { DatePipe } from '@angular/common';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminAuditLogsApiService } from '../../data-access/admin-audit-logs-api.service';
import type { AdminAuditLogList } from '../../domain/admin-audit-log.models';

@Component({
  selector: 'app-admin-audit-logs-list-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './admin-audit-logs-list-page.component.html',
  styleUrl: './admin-audit-logs-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditLogsListPageComponent implements OnInit {
  private readonly api = inject(AdminAuditLogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly result = signal<AdminAuditLogList | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected actorId = '';
  protected action = '';
  protected entityType = '';
  protected entityId = '';
  protected requestId = '';
  protected from = '';
  protected to = '';
  protected page = 1;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.actorId = params.get('actorId') ?? '';
      this.action = params.get('action') ?? '';
      this.entityType = params.get('entityType') ?? '';
      this.entityId = params.get('entityId') ?? '';
      this.requestId = params.get('requestId') ?? '';
      this.from = this.toLocalInput(params.get('from'));
      this.to = this.toLocalInput(params.get('to'));
      this.page = Math.max(1, Number(params.get('page') ?? 1) || 1);
      this.load();
    });
  }

  protected applyFilters(): void {
    void this.navigate(1);
  }

  protected clearFilters(): void {
    this.actorId = '';
    this.action = '';
    this.entityType = '';
    this.entityId = '';
    this.requestId = '';
    this.from = '';
    this.to = '';
    void this.navigate(1);
  }

  protected go(page: number): void {
    if (page < 1) return;
    void this.navigate(page);
  }

  private async navigate(page: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        actorId: this.actorId.trim() || null,
        action: this.action.trim() || null,
        entityType: this.entityType.trim() || null,
        entityId: this.entityId.trim() || null,
        requestId: this.requestId.trim() || null,
        from: this.toIso(this.from),
        to: this.toIso(this.to),
        page: page > 1 ? page : null,
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({
        actorId: this.actorId.trim() || undefined,
        action: this.action.trim() || undefined,
        entityType: this.entityType.trim() || undefined,
        entityId: this.entityId.trim() || undefined,
        requestId: this.requestId.trim() || undefined,
        from: this.toIso(this.from) ?? undefined,
        to: this.toIso(this.to) ?? undefined,
        page: this.page,
        pageSize: 20,
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

  private toIso(value: string): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private toLocalInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}
