import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { AdminReportsApiService } from '../../data-access/admin-reports-api.service';
import type { AdminReportDetail } from '../../domain/admin-report.models';
import { AdminReportDetailPageComponent } from './admin-report-detail-page.component';

describe('AdminReportDetailPageComponent', () => {
  async function render(anchorContext: AdminReportDetail['anchorContext']) {
    await TestBed.configureTestingModule({
      imports: [AdminReportDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminReportsApiService, useValue: {} },
        { provide: AuthStore, useValue: { user: signal(null) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminReportDetailPageComponent);
    fixture.componentInstance.detail.set({
      id: 'report',
      reason: 'SPAM',
      description: null,
      status: 'OPEN',
      evidence: {
        comment: { body: 'Reported comment' },
        context: { anchor: { quote: 'Unverified legacy hint' } },
      },
      resolutionNote: null,
      createdAt: '2026-09-09T00:00:00Z',
      updatedAt: '2026-09-09T00:00:00Z',
      resolvedAt: null,
      reporter: null,
      reportedUser: null,
      currentComment: null,
      story: { id: 'story', slug: 'story', title: 'Story' },
      chapter: { id: 'chapter', number: 1, title: 'Chapter' },
      relatedReportCount: 1,
      recentUserModerationCount: 0,
      moderationActions: [],
      anchorContext,
    });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders snapshot versions and quotes as text even when the current comment is gone', async () => {
    const element = await render({
      blockId: 'block-id',
      quote: '<img src=x onerror=alert(1)> Quote',
      chapterVersion: 2,
      reportedChapterVersion: 5,
      lastVerifiedVersion: 4,
      status: 'ORPHANED',
      rootCommentId: 'root',
    });
    const context = element.querySelector('.anchor-context');
    expect(context?.textContent).toContain('v2');
    expect(context?.textContent).toContain('v5');
    expect(context?.textContent).toContain('v4');
    expect(context?.textContent).toContain('Không còn khớp');
    expect(context?.textContent).toContain('<img src=x onerror=alert(1)> Quote');
    expect(context?.querySelector('img')).toBeNull();
  });

  it('does not present old client hints as a verified snapshot', async () => {
    const element = await render(null);
    expect(element.querySelector('.anchor-context')).toBeNull();
    expect(element.textContent).not.toContain('Unverified legacy hint');
  });
});
