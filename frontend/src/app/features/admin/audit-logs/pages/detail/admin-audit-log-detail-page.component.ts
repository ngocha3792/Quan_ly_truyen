import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminAuditLogsApiService } from '../../data-access/admin-audit-logs-api.service';
import type { AdminAuditLogDetail } from '../../domain/admin-audit-log.models';
import { AuditDiffComponent } from '../../ui/audit-diff/audit-diff.component';
import { AuditJsonViewerComponent } from '../../ui/audit-json-viewer/audit-json-viewer.component';

@Component({
  selector: 'app-admin-audit-log-detail-page',
  standalone: true,
  imports: [AuditDiffComponent, AuditJsonViewerComponent, DatePipe, RouterLink],
  templateUrl: './admin-audit-log-detail-page.component.html',
  styleUrl: './admin-audit-log-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditLogDetailPageComponent implements OnInit {
  private readonly api = inject(AdminAuditLogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly detail = signal<AdminAuditLogDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected entityLink(detail: AdminAuditLogDetail): string[] | null {
    const id = detail.entity.id;
    if (!id) return null;
    switch (detail.entity.type.toLowerCase()) {
      case 'user': return ['/admin/users', id];
      case 'author': return ['/admin/authors', id];
      case 'report': return ['/admin/reports', id];
      case 'story_submission': return ['/admin/story-submissions', id];
      default: return null;
    }
  }

  protected copy(value: string | null): void {
    if (value && navigator.clipboard) void navigator.clipboard.writeText(value);
  }

  private load(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.error.set('');
    this.api.detail(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detail) => this.detail.set(detail),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
