import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';
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

  ngOnInit(): void {
    const subscription = this.route.paramMap.subscribe((params) => {
      const storySlug = params.get('storySlug') ?? '';
      const chapterNumber = params.get('chapterNumber') ?? '';
      if (storySlug && chapterNumber) this.store.load(storySlug, chapterNumber);
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
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

  private requireLogin(): boolean {
    if (this.auth.isAuthenticated()) return true;
    void this.router.navigate(['/dang-nhap'], {
      queryParams: { returnUrl: this.router.url },
    });
    return false;
  }
}
