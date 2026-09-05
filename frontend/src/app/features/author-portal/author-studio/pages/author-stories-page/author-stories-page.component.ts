import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { LinkButtonComponent } from '../../../../../shared/components/link-button/link-button.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';
import { AuthorStoriesStore } from '../../data-access/author-stories.store';
import { AuthorManagedStory, AuthorStoryStatus } from '../../domain/author-story-management.models';

@Component({
  selector: 'app-author-stories-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    IconComponent,
    ButtonComponent,
    LinkButtonComponent,
    SearchFieldComponent,
    LoadingStateComponent,
    NoticeComponent,
    EmptyStateComponent,
  ],
  providers: [AuthorStoriesStore],
  templateUrl: './author-stories-page.component.html',
  styleUrl: './author-stories-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorStoriesPageComponent implements OnInit {
  protected readonly store = inject(AuthorStoriesStore);
  protected readonly query = signal('');
  protected readonly filteredStories = computed(() => {
    const keyword = this.query().trim().toLocaleLowerCase('vi');
    if (!keyword) return this.store.stories();

    return this.store
      .stories()
      .filter((story: AuthorManagedStory) => story.title.toLocaleLowerCase('vi').includes(keyword));
  });

  ngOnInit(): void {
    this.store.load();
  }

  protected keywordChanged(value: string): void {
    this.query.set(value);
  }

  protected canDelete(story: AuthorManagedStory): boolean {
    return story.status === 'DRAFT' || story.status === 'REJECTED';
  }

  protected deleteStory(story: AuthorManagedStory): void {
    if (!this.canDelete(story)) return;
    if (!window.confirm(`Xóa bản nháp “${story.title}”?`)) return;
    this.store.deleteDraft(story.id);
  }

  protected statusLabel(status: AuthorStoryStatus): string {
    return STORY_STATUS_LABELS[status];
  }
}

const STORY_STATUS_LABELS: Record<AuthorStoryStatus, string> = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  REJECTED: 'Bị từ chối',
  PUBLISHED: 'Đang xuất bản',
  HIATUS: 'Tạm ngưng',
  SUSPENDED: 'Bị đình chỉ',
  COMPLETED: 'Hoàn thành',
  ARCHIVED: 'Lưu trữ',
};
