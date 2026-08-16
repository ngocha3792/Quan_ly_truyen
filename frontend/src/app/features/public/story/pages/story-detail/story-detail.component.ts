import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { LibraryStore } from '../../../../../core/storage/library.store';
import { SeoService } from '../../../../../core/seo/seo.service';
import type { CommentReactionApiType, CommentReportReasonApi } from '../../../../../core/http/reader-engagement-api.model';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';
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
  ],
  providers: [StoryDetailStore],
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
  protected readonly library = inject(LibraryStore);
  private readonly seo = inject(SeoService);

  private readonly seoEffect = effect(() => {
    const story = this.store.story();

    if (!story) return;

    const description =
      story.description.trim().slice(0, 160) ||
      `Đọc ${story.title} của ${story.author} trên TruyenHub.`;
    const canonicalPath = `/truyen/${encodeURIComponent(story.slug)}`;

    this.seo.apply({
      title: `${story.title} - ${story.author} | TruyenHub`,
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
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.seo.removeStructuredData('story'));

    const sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      if (slug) this.store.loadStory(slug);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  protected toggleLibrary(): void {
    const current = this.store.story();
    if (current) this.library.toggle(current.id);
  }

  protected rate(score: number): void {
    if (!this.requireLogin()) return;
    this.store.setRating(score);
  }

  protected clearRating(): void {
    if (!this.requireLogin()) return;
    this.store.clearRating();
  }

  protected addComment(body: string): void {
    if (!this.requireLogin()) return;
    this.store.addComment(body);
  }

  protected editComment(event: { readonly id: string; readonly body: string }): void {
    if (!this.requireLogin()) return;
    this.store.editComment(event.id, event.body);
  }

  protected deleteComment(commentId: string): void {
    if (!this.requireLogin()) return;
    this.store.deleteComment(commentId);
  }

  protected loadReplies(rootCommentId: string): void {
    this.store.loadReplies(rootCommentId);
  }

  protected reply(event: { readonly rootId: string; readonly parentId: string; readonly body: string }): void {
    if (!this.requireLogin()) return;
    this.store.reply(event.rootId, event.parentId, event.body);
  }

  protected react(event: { readonly commentId: string; readonly type: CommentReactionApiType }): void {
    if (!this.requireLogin()) return;
    this.store.react(event.commentId, event.type);
  }

  protected report(event: { readonly commentId: string; readonly reason: CommentReportReasonApi; readonly description?: string }): void {
    if (!this.requireLogin()) return;
    this.store.report(event.commentId, event.reason, event.description);
  }

  private requireLogin(): boolean {
    if (this.auth.isAuthenticated()) return true;
    void this.router.navigate(['/dang-nhap'], {
      queryParams: { returnUrl: this.router.url },
    });
    return false;
  }
}
