import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { AdminAuthorApplicationActionsStore } from './admin-author-application-actions.store';
import { AdminAuthorApplicationDetailStore } from './admin-author-application-detail.store';
import { AdminAuthorApplicationsApiService } from './admin-author-applications-api.service';

describe('Admin author application detail/actions stores', () => {
  let detailStore: AdminAuthorApplicationDetailStore;

  let actionsStore: AdminAuthorApplicationActionsStore;

  let lifecycle: AuthSessionLifecycleService;

  let api: Record<'list' | 'getOne' | 'approve' | 'reject', ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      list: vi.fn(),

      getOne: vi.fn(),

      approve: vi.fn(),

      reject: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAuthorApplicationDetailStore,

        AdminAuthorApplicationActionsStore,

        AuthSessionLifecycleService,

        {
          provide: AdminAuthorApplicationsApiService,

          useValue: api,
        },
      ],
    });

    lifecycle = TestBed.inject(AuthSessionLifecycleService);

    detailStore = TestBed.inject(AdminAuthorApplicationDetailStore);

    actionsStore = TestBed.inject(AdminAuthorApplicationActionsStore);

    lifecycle.establishSession(
      'reviewer-a',

      'session-a',

      false,
    );
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('approve thay detail từ PENDING sang APPROVED', async () => {
    loadPendingApplication();

    api.approve.mockReturnValue(of(application('APPROVED')));

    await firstValueFrom(actionsStore.approve());

    expect(api.approve).toHaveBeenCalledWith(
      'application-1',

      expect.any(String),
    );

    expect(detailStore.detail()?.status).toBe('APPROVED');

    expect(actionsStore.message()).toContain('được duyệt');
  });

  it.each([
    {
      status: 0,

      statusText: 'Unknown Error',
    },

    {
      status: 503,

      statusText: 'Service Unavailable',
    },
  ])(
    'approve retry sau HTTP $status phải reuse cùng idempotency key',

    async ({ status, statusText }) => {
      loadPendingApplication();

      const transientError = new HttpErrorResponse({
        status,

        statusText,

        url: '/api/v1/author-applications/admin/application-1/approve',
      });

      api.approve
        .mockReturnValueOnce(throwError(() => transientError))
        .mockReturnValueOnce(of(application('APPROVED')));

      await expect(firstValueFrom(actionsStore.approve())).rejects.toBe(transientError);

      const firstKey = api.approve.mock.calls[0]?.[1];

      expect(firstKey).toEqual(expect.any(String));

      /*
       * Request lỗi không được tự thay local detail.
       */
      expect(detailStore.detail()?.status).toBe('PENDING');

      await firstValueFrom(actionsStore.approve());

      const secondKey = api.approve.mock.calls[1]?.[1];

      /*
       * Invariant chính của Phase 3.
       */
      expect(secondKey).toBe(firstKey);

      expect(detailStore.detail()?.status).toBe('APPROVED');
    },
  );

  it('reject retry cùng reason sau lỗi phải reuse cùng idempotency key', async () => {
    loadPendingApplication();

    const transientError = new HttpErrorResponse({
      status: 503,

      statusText: 'Service Unavailable',

      url: '/api/v1/author-applications/admin/application-1/reject',
    });

    const reason = 'Mẫu nội dung chưa đáp ứng tiêu chí xét duyệt.';

    api.reject
      .mockReturnValueOnce(throwError(() => transientError))
      .mockReturnValueOnce(of(application('REJECTED')));

    /*
     * Có whitespace để verify normalized operation identity.
     */
    await expect(firstValueFrom(actionsStore.reject(`  ${reason}  `))).rejects.toBe(transientError);

    const firstCall = api.reject.mock.calls[0];

    const firstKey = firstCall?.[2];

    expect(firstCall?.[0]).toBe('application-1');

    expect(firstCall?.[1]).toBe(reason);

    expect(firstKey).toEqual(expect.any(String));

    /*
     * Retry cùng normalized reason.
     */
    await firstValueFrom(actionsStore.reject(reason));

    const secondCall = api.reject.mock.calls[1];

    const secondKey = secondCall?.[2];

    expect(secondCall?.[1]).toBe(reason);

    expect(secondKey).toBe(firstKey);

    expect(detailStore.detail()?.status).toBe('REJECTED');
  });

  it('reject đổi reason phải sinh idempotency key mới', async () => {
    loadPendingApplication();

    const transientError = new HttpErrorResponse({
      status: 503,

      statusText: 'Service Unavailable',

      url: '/api/v1/author-applications/admin/application-1/reject',
    });

    api.reject.mockReturnValue(throwError(() => transientError));

    await expect(
      firstValueFrom(actionsStore.reject('Mẫu nội dung cần bổ sung thêm phần mở đầu.')),
    ).rejects.toBe(transientError);

    const firstKey = api.reject.mock.calls[0]?.[2];

    await expect(
      firstValueFrom(actionsStore.reject('Mẫu nội dung cần chỉnh sửa lại cấu trúc chương.')),
    ).rejects.toBe(transientError);

    const secondKey = api.reject.mock.calls[1]?.[2];

    expect(firstKey).toEqual(expect.any(String));

    expect(secondKey).toEqual(expect.any(String));

    /*
     * Khác body nhưng cùng key sẽ bị backend
     * IDEMPOTENCY_CONFLICT.
     *
     * Vì vậy đổi reason bắt buộc phải đổi key.
     */
    expect(secondKey).not.toBe(firstKey);
  });

  it('đổi action từ approve sang reject phải sinh idempotency key mới', async () => {
    loadPendingApplication();

    const transientError = new HttpErrorResponse({
      status: 503,

      statusText: 'Service Unavailable',
    });

    api.approve.mockReturnValue(throwError(() => transientError));

    api.reject.mockReturnValue(throwError(() => transientError));

    await expect(firstValueFrom(actionsStore.approve())).rejects.toBe(transientError);

    const approveKey = api.approve.mock.calls[0]?.[1];

    await expect(
      firstValueFrom(actionsStore.reject('Hồ sơ cần bổ sung thêm thông tin kinh nghiệm.')),
    ).rejects.toBe(transientError);

    const rejectKey = api.reject.mock.calls[0]?.[2];

    expect(approveKey).toEqual(expect.any(String));

    expect(rejectKey).toEqual(expect.any(String));

    expect(rejectKey).not.toBe(approveKey);
  });

  it('review thành công phải clear retry key để operation mới nhận key mới', async () => {
    loadPendingApplication();

    api.approve.mockReturnValueOnce(of(application('APPROVED')));

    await firstValueFrom(actionsStore.approve());

    const completedKey = api.approve.mock.calls[0]?.[1];

    /*
     * Mô phỏng application cùng ID
     * được mở lại thành PENDING ở cycle sau.
     */
    detailStore.replace(application('PENDING'));

    api.approve.mockReturnValueOnce(of(application('APPROVED')));

    await firstValueFrom(actionsStore.approve());

    const nextOperationKey = api.approve.mock.calls[1]?.[1];

    /*
     * Operation trước đã authoritative success,
     * không được reuse key cũ.
     */
    expect(nextOperationKey).not.toBe(completedKey);
  });

  it('đổi auth session phải clear retry operation của reviewer cũ', async () => {
    loadPendingApplication();

    const transientError = new HttpErrorResponse({
      status: 503,

      statusText: 'Service Unavailable',
    });

    api.approve.mockReturnValue(throwError(() => transientError));

    await expect(firstValueFrom(actionsStore.approve())).rejects.toBe(transientError);

    const reviewerAKey = api.approve.mock.calls[0]?.[1];

    /*
     * Session reviewer thay đổi.
     *
     * ActionsStore nhận lifecycle event và reset.
     */
    lifecycle.establishSession(
      'reviewer-b',

      'session-b',

      false,
    );

    /*
     * DetailStore cũng reset theo lifecycle.
     * Mô phỏng reviewer mới load lại cùng application.
     */
    detailStore.replace(application('PENDING'));

    await expect(firstValueFrom(actionsStore.approve())).rejects.toBe(transientError);

    const reviewerBKey = api.approve.mock.calls[1]?.[1];

    expect(reviewerBKey).not.toBe(reviewerAKey);
  });

  it('action thứ hai khi review đang chạy không được thay pending operation', async () => {
    loadPendingApplication();

    const inFlight = new Subject<ReturnType<typeof application>>();

    const transientError = new HttpErrorResponse({
      status: 503,

      statusText: 'Service Unavailable',
    });

    api.approve
      .mockReturnValueOnce(inFlight.asObservable())
      .mockReturnValueOnce(of(application('APPROVED')));

    const firstApprovePromise = firstValueFrom(actionsStore.approve());

    const firstKey = api.approve.mock.calls[0]?.[1];

    /*
     * Approve vẫn đang chạy.
     *
     * Reject thứ hai phải bị chặn trước khi resolve
     * operation, vì nếu không nó có thể rotate key
     * của approve đang pending.
     */
    await expect(
      firstValueFrom(actionsStore.reject('Hồ sơ cần bổ sung thêm thông tin kinh nghiệm.')),
    ).rejects.toThrow('Một thao tác xét duyệt khác đang được thực hiện.');

    expect(api.reject).not.toHaveBeenCalled();

    /*
     * Approve đầu tiên thất bại sau đó.
     */
    inFlight.error(transientError);

    await expect(firstApprovePromise).rejects.toBe(transientError);

    /*
     * Retry approve phải vẫn reuse key đầu tiên.
     */
    await firstValueFrom(actionsStore.approve());

    const retryKey = api.approve.mock.calls[1]?.[1];

    expect(retryKey).toBe(firstKey);
  });

  it('detail response của reviewer cũ không chảy sang session mới', () => {
    const result$ = new Subject<ReturnType<typeof application>>();

    api.getOne.mockReturnValue(result$.asObservable());

    detailStore.load('application-1');

    lifecycle.establishSession(
      'reviewer-b',

      'session-b',

      false,
    );

    result$.next(application('PENDING'));

    result$.complete();

    expect(detailStore.detail()).toBeNull();
  });

  function loadPendingApplication(): void {
    api.getOne.mockReturnValue(of(application('PENDING')));

    detailStore.load('application-1');
  }
});

function application(status: 'PENDING' | 'APPROVED' | 'REJECTED') {
  return {
    applicationId: 'application-1',

    userId: 'applicant-1',

    status,

    penName: 'Store Pen',

    fullName: 'Store Applicant',

    email: 'store@example.test',

    phone: '0900000000',

    portfolioUrl: null,

    primaryGenre: 'Fantasy',

    experience: '1-3-years',

    introduction: 'Introduction',

    firstWorkSynopsis: 'Synopsis',

    acceptedTerms: true,

    sample: null,

    submittedAt: '2026-08-08T12:00:00.000Z',

    reviewedAt: status === 'PENDING' ? null : '2026-08-08T13:00:00.000Z',

    reviewedById: status === 'PENDING' ? null : 'reviewer-a',

    rejectionReason: status === 'REJECTED' ? 'Rejected reason' : null,

    createdAt: '2026-08-08T11:00:00.000Z',

    updatedAt: '2026-08-08T13:00:00.000Z',
  } as const;
}
