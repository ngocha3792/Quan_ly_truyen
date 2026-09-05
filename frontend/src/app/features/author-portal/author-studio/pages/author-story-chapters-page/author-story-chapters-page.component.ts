import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { LinkButtonComponent } from '../../../../../shared/components/link-button/link-button.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { AuthorChaptersStore } from '../../data-access/author-chapters.store';
import {
  AuthorManagedChapterSummary,
  AuthorManagedStory,
} from '../../domain/author-story-management.models';

@Component({
  selector: 'app-author-story-chapters-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    ButtonComponent,
    LinkButtonComponent,
    LoadingStateComponent,
    NoticeComponent,
    EmptyStateComponent,
  ],
  providers: [AuthorChaptersStore],
  templateUrl: './author-story-chapters-page.component.html',
  styleUrl: './author-story-chapters-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorStoryChaptersPageComponent implements OnInit {
  protected readonly store = inject(AuthorChaptersStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly storyId = this.route.snapshot.paramMap.get('storyId') ?? '';

  ngOnInit(): void {
    this.store.load(this.storyId);
  }

  protected canCreate(story: AuthorManagedStory): boolean {
    return story.status !== 'PENDING_REVIEW';
  }

  protected canEdit(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return story.status !== 'PENDING_REVIEW' && chapter.status === 'DRAFT';
  }

  protected canPublish(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): boolean {
    return story.status === 'PUBLISHED' && chapter.status === 'DRAFT' && chapter.wordCount > 0;
  }

  protected deleteChapter(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (!this.canEdit(story, chapter)) return;
    if (!window.confirm(`Xóa bản nháp chương ${chapter.number}: “${chapter.title}”?`)) return;
    this.store.deleteDraft(story.id, chapter.id);
  }

  protected publishChapter(story: AuthorManagedStory, chapter: AuthorManagedChapterSummary): void {
    if (!this.canPublish(story, chapter)) return;
    if (!window.confirm(`Xuất bản chương ${chapter.number}: “${chapter.title}”?`)) return;
    this.store.publish(story.id, chapter.id);
  }
}
