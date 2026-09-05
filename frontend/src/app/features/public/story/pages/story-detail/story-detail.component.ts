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
import { LibraryStore } from '../../../../../core/storage/library.store';
import { SeoService } from '../../../../../core/seo/seo.service';
import { APP_NAME } from '../../../../../core/config/app-identity.constants';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../../core/http/reader-engagement-api.model';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';
import { StoryChapterListStore } from '../../data-access/story-chapter-list.store';
import { StoryDetailStore } from '../../data-access/story.store';
import { StoryCommentsComponent } from '../../ui/story-comments/story-comments.component';
import { StoryRelatedComponent } from '../../ui/story-related/story-related.component';

@Component({
  selector: 'app-story-detail',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    CompactNumberPipe,
    RelativeTimePipe,
    StoryCommentsComponent,
    StoryRelatedComponent,
    PaginationComponent,
  ],
  providers: [StoryDetailStore, StoryChapterListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-detail.component.html',
  styleUrl: './story-detail.component.scss',
})
export class StoryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthStore);
  protected readonly store = inject(StoryDetailStore);
  protected readonly chapterList = inject(StoryChapterListStore);
  protected readonly library = inject(LibraryStore);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(ReaderAnalyticsService);
  private trackedStoryId: string | null = null;

  private readonly seoEffect = effect(() => {
    const story = this.store.story();

    if (!story) return;

    const description =
      story.description.trim().slice(0, 160) ||
      `Đọc ${story.title} của ${story.author} trên ${APP_NAME}.`;
    const canonicalPath = `/truyen/${encodeURIComponent(story.slug)}`;

    this.seo.apply({
      title: `${story.title} - ${story.author} | ${APP_NAME}`,
      description,
      canonicalPath,
      imageUrl: story.coverUrl,
      type: 'book',
    });

    this.seo.setStructuredData('story', {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: story.title,
      description,
      image: this.seo.absoluteUrl(story.coverUrl),
      genre: story.categories,
      author: { '@type': 'Person', name: story.author },
      url: this.seo.absoluteUrl(canonicalPath),
    });

    if (this.trackedStoryId !== story.id) {
      this.trackedStoryId = story.id;
      this.analytics.storyView(story.id);
    }
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.seo.removeStructuredData('story'));

    const sub = this.route.paramMap.subscribe((params) => {
      this.trackedStoryId = null;
      const slug = params.get('slug') ?? '';
      if (slug) {
        this.store.loadStory(slug);
        this.chapterList.load(slug);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  protected toggleLibrary(): void {
    const current = this.store.story();
    if (current) this.library.toggle(current.id);
  }

  protected toggleStoryFollow(): void {
    this.runAuthenticated(() => this.store.toggleStoryFollow());
  }

  protected rate(score: number): void {
    this.runAuthenticated(() => this.store.setRating(score));
  }

  protected clearRating(): void {
    this.runAuthenticated(() => this.store.clearRating());
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
