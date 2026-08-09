import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
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
    api = { list: vi.fn(), getOne: vi.fn(), approve: vi.fn(), reject: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        AdminAuthorApplicationDetailStore,
        AdminAuthorApplicationActionsStore,
        AuthSessionLifecycleService,
        { provide: AdminAuthorApplicationsApiService, useValue: api },
      ],
    });
    lifecycle = TestBed.inject(AuthSessionLifecycleService);
    detailStore = TestBed.inject(AdminAuthorApplicationDetailStore);
    actionsStore = TestBed.inject(AdminAuthorApplicationActionsStore);
    lifecycle.establishSession('reviewer-a', 'session-a', false);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('approve thay detail từ PENDING sang APPROVED', async () => {
    api.getOne.mockReturnValue(of(application('PENDING')));
    detailStore.load('application-1');
    api.approve.mockReturnValue(of(application('APPROVED')));
    await firstValueFrom(actionsStore.approve());
    expect(api.approve).toHaveBeenCalledWith('application-1');
    expect(detailStore.detail()?.status).toBe('APPROVED');
    expect(actionsStore.message()).toContain('được duyệt');
  });

  it('detail response của reviewer cũ không chảy sang session mới', () => {
    const result$ = new Subject<ReturnType<typeof application>>();
    api.getOne.mockReturnValue(result$.asObservable());
    detailStore.load('application-1');
    lifecycle.establishSession('reviewer-b', 'session-b', false);
    result$.next(application('PENDING'));
    result$.complete();
    expect(detailStore.detail()).toBeNull();
  });
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
