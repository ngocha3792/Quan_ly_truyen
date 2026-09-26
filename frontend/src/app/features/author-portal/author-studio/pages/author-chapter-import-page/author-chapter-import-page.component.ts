import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import {
  CHAPTER_IMPORT_ACCEPT,
  ChapterFileReaderService,
} from '../../data-access/chapter-file-reader.service';
import { ChapterImportStore } from '../../data-access/chapter-import.store';

@Component({
  selector: 'app-author-chapter-import-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    ButtonComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    NoticeComponent,
    PageHeadingComponent,
  ],
  providers: [ChapterImportStore, ChapterFileReaderService],
  templateUrl: './author-chapter-import-page.component.html',
  styleUrl: './author-chapter-import-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorChapterImportPageComponent {
  protected readonly store = inject(ChapterImportStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly accept = CHAPTER_IMPORT_ACCEPT;
  protected readonly storyId = this.route.snapshot.paramMap.get('storyId') ?? '';
  protected readonly chapters = computed(() => this.store.parsed()?.chapters ?? []);
  protected readonly preamble = computed(() => this.store.parsed()?.ignoredPreamble ?? '');
  protected readonly breadcrumbs = computed(() => [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Truyện của tôi', route: '/author-studio/truyen' },
    {
      label: 'Quản lý chương',
      route: `/author-studio/truyen/${this.storyId}/chuong`,
    },
    { label: 'Nhập chương từ file' },
  ]);

  protected async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) await this.store.choose(file);
  }

  /**
   * Hỏi lại trước khi tạo, và nhắc luôn phần lời tựa sẽ bị bỏ lại: đó là thứ
   * duy nhất trong file không đi đâu cả.
   */
  protected async confirm(): Promise<void> {
    const count = this.chapters().length;
    const warning = this.preamble() ? '\n\nĐoạn nằm trước chương đầu tiên sẽ KHÔNG được nhập.' : '';
    if (!window.confirm(`Tạo ${count} chương nháp từ file này?${warning}`)) return;

    if (await this.store.importAll(this.storyId)) {
      await this.router.navigate(['/author-studio/truyen', this.storyId, 'chuong']);
    }
  }
}
