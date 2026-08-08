import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { AdminAuthorApplicationsStore } from '../../data-access/admin-author-applications.store';

import { AdminAuthorApplicationApproveDialogComponent } from '../../ui/admin-author-application-approve-dialog.component';

import { AdminAuthorApplicationRejectDialogComponent } from '../../ui/admin-author-application-reject-dialog.component';

import { AdminAuthorApplicationStatusBadgeComponent } from '../../ui/admin-author-application-status-badge.component';

@Component({
  selector: 'app-admin-author-application-detail-page',

  standalone: true,

  imports: [
    RouterLink,

    BreadcrumbComponent,
    PageHeadingComponent,
    LoadingStateComponent,
    ErrorAlertComponent,

    AdminAuthorApplicationStatusBadgeComponent,
    AdminAuthorApplicationApproveDialogComponent,
    AdminAuthorApplicationRejectDialogComponent,
  ],

  providers: [AdminAuthorApplicationsStore],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <main class="admin-page">
      <div class="page-container">
        <app-breadcrumb [items]="breadcrumbs" />

        <app-page-heading
          title="Chi tiết hồ sơ tác giả"
          description="Kiểm tra thông tin, mẫu nội dung và quyết định xét duyệt hồ sơ."
          icon="shield"
        >
          <a class="back-button" routerLink="/admin/author-applications"> ← Danh sách hồ sơ </a>
        </app-page-heading>

        @if (store.detailStatus() === 'loading') {
          <app-loading-state message="Đang tải hồ sơ..." />
        } @else if (store.detailError()) {
          <app-error-alert
            title="Không thể tải hồ sơ"
            [message]="store.detailError()"
            (retry)="store.loadDetail(applicationId)"
          />
        } @else if (store.detail(); as application) {
          @if (store.actionMessage()) {
            <div class="message message--success">
              {{ store.actionMessage() }}
            </div>
          }

          @if (store.actionError()) {
            <div class="message message--error">
              {{ store.actionError() }}
            </div>
          }

          <section class="review-header">
            <div>
              <div class="review-heading">
                <h2>
                  {{ application.penName || 'Chưa có bút danh' }}
                </h2>

                <app-admin-author-application-status-badge [status]="application.status" />
              </div>

              <p>
                Mã hồ sơ:
                {{ application.applicationId }}
              </p>
            </div>

            @if (application.status === 'PENDING') {
              <div class="review-actions">
                <button
                  type="button"
                  class="reject-button"
                  [disabled]="store.isReviewing()"
                  (click)="openRejectDialog()"
                >
                  Từ chối
                </button>

                <button
                  type="button"
                  class="approve-button"
                  [disabled]="store.isReviewing()"
                  (click)="openApproveDialog()"
                >
                  Duyệt hồ sơ
                </button>
              </div>
            }
          </section>

          <div class="detail-grid">
            <section class="detail-card">
              <h3>Thông tin người đăng ký</h3>

              <div class="field-grid">
                <div class="field">
                  <span> Họ và tên </span>

                  <strong>
                    {{ displayText(application.fullName) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Bút danh </span>

                  <strong>
                    {{ displayText(application.penName) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Email </span>

                  <strong>
                    {{ displayText(application.email) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Số điện thoại </span>

                  <strong>
                    {{ displayText(application.phone) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Thể loại chính </span>

                  <strong>
                    {{ displayText(application.primaryGenre) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Kinh nghiệm </span>

                  <strong>
                    {{ displayText(application.experience) }}
                  </strong>
                </div>

                <div class="field field--full">
                  <span> Portfolio </span>

                  @if (application.portfolioUrl) {
                    <a [href]="application.portfolioUrl" target="_blank" rel="noopener noreferrer">
                      {{ application.portfolioUrl }}
                    </a>
                  } @else {
                    <strong>—</strong>
                  }
                </div>
              </div>
            </section>

            <section class="detail-card">
              <h3>Thời gian xử lý</h3>

              <div class="field-grid">
                <div class="field">
                  <span> Tạo hồ sơ </span>

                  <strong>
                    {{ formatDate(application.createdAt) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Gửi hồ sơ </span>

                  <strong>
                    {{ formatDate(application.submittedAt) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Xét duyệt </span>

                  <strong>
                    {{ formatDate(application.reviewedAt) }}
                  </strong>
                </div>

                <div class="field">
                  <span> Reviewer ID </span>

                  <strong>
                    {{ displayText(application.reviewedById) }}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          <section class="detail-card content-card">
            <h3>Giới thiệu bản thân</h3>

            <p>
              {{ displayText(application.introduction) }}
            </p>
          </section>

          <section class="detail-card content-card">
            <h3>Ý tưởng / tóm tắt tác phẩm</h3>

            <p>
              {{ displayText(application.firstWorkSynopsis) }}
            </p>
          </section>

          <section class="detail-card">
            <h3>Mẫu chương truyện</h3>

            @if (application.sample; as sample) {
              <div class="sample-file">
                <div>
                  <strong>
                    {{ sample.fileName || 'File mẫu' }}
                  </strong>

                  <small>
                    {{ sample.mimeType || 'Không rõ định dạng' }}
                    ·
                    {{ formatFileSize(sample.sizeBytes) }}
                  </small>
                </div>

                @if (sample.url) {
                  <a [href]="sample.url" target="_blank" rel="noopener noreferrer"> Mở file mẫu </a>
                }
              </div>
            } @else {
              <p class="muted">Hồ sơ chưa có file mẫu.</p>
            }
          </section>

          @if (application.status === 'REJECTED' && application.rejectionReason) {
            <section class="detail-card rejection-card">
              <h3>Lý do từ chối</h3>

              <p>
                {{ application.rejectionReason }}
              </p>
            </section>
          }

          <section class="detail-card">
            <h3>Cam kết</h3>

            <p>
              {{
                application.acceptedTerms
                  ? 'Người đăng ký đã đồng ý với quy định nội dung và chính sách cộng đồng.'
                  : 'Người đăng ký chưa xác nhận điều khoản.'
              }}
            </p>
          </section>

          @if (approveDialogOpen()) {
            <app-admin-author-application-approve-dialog
              [penName]="application.penName"
              [loading]="store.actionStatus() === 'approving'"
              (cancel)="closeApproveDialog()"
              (confirm)="handleApprove()"
            />
          }

          @if (rejectDialogOpen()) {
            <app-admin-author-application-reject-dialog
              [loading]="store.actionStatus() === 'rejecting'"
              (cancel)="closeRejectDialog()"
              (confirm)="handleReject($event)"
            />
          }
        }
      </div>
    </main>
  `,

  styles: `
    :host {
      display: block;

      min-height: 100%;
    }

    .admin-page {
      min-height: calc(100vh - 72px);

      padding: 1.25rem 0 4rem;

      color: var(--text-strong);

      background:
        radial-gradient(circle at 10% 5%, rgba(103, 44, 204, 0.08), transparent 480px), #060b16;
    }

    .back-button {
      color: #a78bfa;

      font-size: 13px;

      font-weight: 700;

      text-decoration: none;
    }

    .message {
      margin-bottom: 16px;

      padding: 12px 16px;

      border-radius: 8px;

      font-size: 13px;
    }

    .message--success {
      border: 1px solid rgba(34, 197, 94, 0.2);

      color: #86efac;

      background: rgba(34, 197, 94, 0.08);
    }

    .message--error {
      border: 1px solid rgba(244, 63, 94, 0.2);

      color: #fda4af;

      background: rgba(244, 63, 94, 0.08);
    }

    .review-header {
      margin-bottom: 18px;

      padding: 20px;

      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 20px;

      border: 1px solid var(--border);

      border-radius: 14px;

      background: rgba(14, 21, 38, 0.86);
    }

    .review-heading {
      display: flex;

      align-items: center;

      flex-wrap: wrap;

      gap: 12px;
    }

    .review-heading h2 {
      margin: 0;

      color: #f8fafc;

      font-size: 22px;
    }

    .review-header p {
      margin: 7px 0 0;

      color: #64748b;

      font-size: 11px;

      word-break: break-all;
    }

    .review-actions {
      display: flex;

      gap: 10px;
    }

    .review-actions button {
      min-height: 40px;

      padding: 0 17px;

      border-radius: 8px;

      font-weight: 700;

      cursor: pointer;
    }

    .review-actions button:disabled {
      opacity: 0.55;

      cursor: not-allowed;
    }

    .approve-button {
      border: 0;

      color: #fff;

      background: linear-gradient(135deg, #16a34a, #22c55e);
    }

    .reject-button {
      border: 1px solid rgba(244, 63, 94, 0.32);

      color: #fda4af;

      background: rgba(190, 24, 93, 0.08);
    }

    .detail-grid {
      margin-bottom: 18px;

      display: grid;

      grid-template-columns:
        minmax(0, 2fr)
        minmax(280px, 1fr);

      gap: 18px;
    }

    .detail-card {
      margin-bottom: 18px;

      padding: 20px;

      border: 1px solid var(--border);

      border-radius: 12px;

      background: rgba(14, 21, 38, 0.86);
    }

    .detail-grid .detail-card {
      margin-bottom: 0;
    }

    .detail-card h3 {
      margin: 0 0 16px;

      color: #f1f5f9;

      font-size: 15px;
    }

    .field-grid {
      display: grid;

      grid-template-columns: repeat(2, minmax(0, 1fr));

      gap: 17px;
    }

    .field {
      min-width: 0;

      display: grid;

      gap: 5px;
    }

    .field--full {
      grid-column: 1 / -1;
    }

    .field span {
      color: #64748b;

      font-size: 11px;

      font-weight: 700;

      text-transform: uppercase;

      letter-spacing: 0.04em;
    }

    .field strong,
    .field a {
      min-width: 0;

      color: #e2e8f0;

      font-size: 13px;

      font-weight: 600;

      word-break: break-word;
    }

    .field a {
      color: #a78bfa;
    }

    .content-card p,
    .rejection-card p,
    .detail-card > p {
      margin: 0;

      color: #a7b0c0;

      line-height: 1.75;

      white-space: pre-wrap;
    }

    .rejection-card {
      border-color: rgba(244, 63, 94, 0.22);

      background: rgba(190, 24, 93, 0.06);
    }

    .sample-file {
      padding: 14px;

      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 16px;

      border: 1px solid rgba(148, 163, 184, 0.14);

      border-radius: 99px;

      background: rgba(2, 6, 23, 0.3);
    }

    .sample-file div {
      min-width: 0;

      display: grid;

      gap: 5px;
    }

    .sample-file strong {
      color: #e2e8f0;
    }

    .sample-file small {
      color: #64748b;
    }

    .sample-file a {
      flex: 0 0 auto;

      color: #c4a5f6;

      font-size: 13px;

      font-weight: 700;
    }

    .muted {
      color: #64748b;
    }

    @media (max-width: 850px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 650px) {
      .review-header {
        align-items: stretch;

        flex-direction: column;
      }

      .review-actions {
        width: 100%;
      }

      .review-actions button {
        flex: 1;
      }

      .field-grid {
        grid-template-columns: 1fr;
      }

      .field--full {
        grid-column: auto;
      }

      .sample-file {
        align-items: flex-start;

        flex-direction: column;
      }
    }
  `,
})
export class AdminAuthorApplicationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);

  protected readonly store = inject(AdminAuthorApplicationsStore);

  protected readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';

  protected readonly approveDialogOpen = signal(false);

  protected readonly rejectDialogOpen = signal(false);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',

      route: '/',
    },

    {
      label: 'Hồ sơ tác giả',

      route: '/admin/author-applications',
    },

    {
      label: 'Chi tiết',
    },
  ];

  ngOnInit(): void {
    this.store.loadDetail(this.applicationId);
  }

  protected openApproveDialog(): void {
    this.store.clearActionFeedback();

    this.approveDialogOpen.set(true);
  }

  protected closeApproveDialog(): void {
    if (this.store.isReviewing()) {
      return;
    }

    this.approveDialogOpen.set(false);
  }

  protected openRejectDialog(): void {
    this.store.clearActionFeedback();

    this.rejectDialogOpen.set(true);
  }

  protected closeRejectDialog(): void {
    if (this.store.isReviewing()) {
      return;
    }

    this.rejectDialogOpen.set(false);
  }

  protected handleApprove(): void {
    this.store
      .approve()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.approveDialogOpen.set(false);
        },
      });
  }

  protected handleReject(reason: string): void {
    this.store
      .reject(reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rejectDialogOpen.set(false);
        },
      });
  }

  protected displayText(value: string | null | undefined): string {
    const normalized = value?.trim();

    return normalized || '—';
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleString('vi-VN');
  }

  protected formatFileSize(value: string | null): string {
    if (!value) {
      return 'Không rõ kích thước';
    }

    const bytes = Number(value);

    if (!Number.isFinite(bytes) || bytes < 0) {
      return 'Không rõ kích thước';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
