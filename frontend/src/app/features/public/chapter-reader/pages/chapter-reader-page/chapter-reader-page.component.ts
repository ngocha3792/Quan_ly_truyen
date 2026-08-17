import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { resolveAuthGuardState } from '../../../../../core/auth/auth-guard.util';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { ReaderAnalyticsService } from '../../../../../core/analytics/reader-analytics.service';
import { SeoService } from '../../../../../core/seo/seo.service';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../../core/http/reader-engagement-api.model';
import { ChapterReaderStore } from '../../data-access/chapter-reader.store';
import { ChapterCommentsComponent } from '../../ui/chapter-comments/chapter-comments.component';
import { ChapterHeadingComponent } from '../../ui/chapter-heading/chapter-heading.component';
import { ChapterSidebarComponent } from '../../ui/chapter-sidebar/chapter-sidebar.component';

@Component({
  selector: 'app-chapter-reader-page',
  standalone: true,
  imports: [RouterLink, ChapterHeadingComponent, ChapterSidebarComponent, ChapterCommentsComponent],
  templateUrl: './chapter-reader-page.component.html',
  styleUrls: ['./chapter-reader-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterReaderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(ChapterReaderStore);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(ReaderAnalyticsService);
  private trackedChapterId: string | null = null;
  private stopAnalyticsSession: (() => void) | null = null;

  private readonly seoEffect = effect(() => {
    const view = this.store.view();

    if (!view) return;

    const chapterLabel = view.chapter.title.trim() || `Chương ${view.chapter.number}`;
    const canonicalPath = `/truyen/${encodeURIComponent(view.story.slug)}/chuong/${view.chapter.number}`;

    this.seo.apply({
      title: `${view.story.title} - ${chapterLabel} | TruyenHub`,
      description: `Đọc ${chapterLabel} của ${view.story.title} online trên TruyenHub.`,
      canonicalPath,
      type: 'article',
    });

    this.seo.setStructuredData('chapter', {
      '@context': 'https://schema.org',
      '@type': 'Chapter',
      name: chapterLabel,
      isPartOf: { '@type': 'Book', name: view.story.title },
      datePublished: view.chapter.publishedAt,
      url: this.seo.absoluteUrl(canonicalPath),
    });

    if (this.trackedChapterId !== view.chapter.id) {
      this.stopAnalyticsSession?.();
      this.trackedChapterId = view.chapter.id;
      const sessionId = this.analytics.newSessionId();
      this.analytics.chapterView(view.story.id, view.chapter.id, sessionId);
      this.stopAnalyticsSession = this.analytics.startChapterSession({
        storyId: view.story.id,
        chapterId: view.chapter.id,
        sessionId,
      });
    }
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.seo.removeStructuredData('chapter');
      this.stopAnalyticsSession?.();
      this.stopAnalyticsSession = null;
    });

    const subscription = this.route.paramMap.subscribe((params) => {
      this.stopAnalyticsSession?.();
      this.stopAnalyticsSession = null;
      this.trackedChapterId = null;
      const storySlug = params.get('storySlug') ?? '';
      const chapterNumber = params.get('chapterNumber') ?? '';
      if (storySlug && chapterNumber) this.store.load(storySlug, chapterNumber);
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected addComment(body: string): void {
    this.runAuthenticated(() => this.store.addComment(body));
  }

  protected editComment(event: { readonly id: string; readonly body: string }): void {
    this.runAuthenticated(() => this.store.editComment(event.id, event.body));
  }

  protected deleteComment(commentId: string): void {
    this.runAuthenticated(() => this.store.deleteComment(commentId));
  }

  protected loadReplies(rootCommentId: string): void {
    this.store.loadReplies(rootCommentId);
  }

  protected reply(event: {
    readonly rootId: string;
    readonly parentId: string;
    readonly body: string;
  }): void {
    this.runAuthenticated(() => this.store.reply(event.rootId, event.parentId, event.body));
  }

  protected react(event: {
    readonly commentId: string;
    readonly type: CommentReactionApiType;
  }): void {
    this.runAuthenticated(() => this.store.react(event.commentId, event.type));
  }

  protected report(event: {
    readonly commentId: string;
    readonly reason: CommentReportReasonApi;
    readonly description?: string;
  }): void {
    this.runAuthenticated(() =>
      this.store.report(event.commentId, event.reason, event.description),
    );
  }

  private runAuthenticated(action: () => void): void {
    const returnUrl = this.router.url;
    resolveAuthGuardState(this.auth).subscribe((resolution) => {
      if (resolution.kind === 'authenticated') {
        action();
        return;
      }

      void this.router.navigate(
        [resolution.kind === 'anonymous' ? '/dang-nhap' : '/tam-thoi-khong-the-xac-thuc'],
        { queryParams: { returnUrl } },
      );
    });
  }
}
