import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { NoticeComponent } from '../../../../../../shared/components/notice/notice.component';
import { AiAuthorHttpRepository } from '../../data-access/ai-author-http.repository';
import { AiAuthorToolsStore } from '../../data-access/ai-author-tools.store';
import { AiAuthorRepository } from '../../domain/ai-author.repository';
import {
  AI_AUTHOR_TOOLS,
  AI_JOB_STATUS_LABELS,
  AiAuthorJob,
  AiAuthorJobType,
} from '../../domain/ai-author.models';
import { AuthorKnowledgeComponent } from '../../ui/author-knowledge/author-knowledge.component';

@Component({
  selector: 'app-ai-author-tools',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonComponent, NoticeComponent, AuthorKnowledgeComponent],
  providers: [
    AiAuthorToolsStore,
    { provide: AiAuthorRepository, useClass: AiAuthorHttpRepository },
  ],
  templateUrl: './ai-author-tools.component.html',
  styleUrl: './ai-author-tools.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAuthorToolsComponent {
  readonly storyId = input.required<string>();
  readonly chapterId = input<string | null>(null);
  readonly sourceVersion = input<number | null>(null);
  readonly unsaved = input(false);
  protected readonly store = inject(AiAuthorToolsStore);
  protected readonly tools = computed(() =>
    AI_AUTHOR_TOOLS.filter((tool) => !tool.chapter || this.chapterId()),
  );
  protected readonly statusLabels = AI_JOB_STATUS_LABELS;
  protected connectionId = '';
  protected tool: AiAuthorJobType = 'STORY_SUMMARY';
  constructor() {
    effect(() => {
      const storyId = this.storyId();
      const chapterId = this.chapterId();
      untracked(() => this.store.load(storyId, chapterId ?? undefined));
    });
  }
  protected create(): void {
    if (!this.connectionId || this.unsaved()) return;
    const chapterTool = AI_AUTHOR_TOOLS.find((tool) => tool.value === this.tool)?.chapter;
    if (chapterTool && !this.chapterId()) return;
    this.store.create({
      jobType: this.tool,
      connectionId: this.connectionId,
      ...(chapterTool
        ? { chapterId: this.chapterId()!, expectedVersion: this.sourceVersion() ?? undefined }
        : {}),
    });
  }
  protected label(type: AiAuthorJobType): string {
    return AI_AUTHOR_TOOLS.find((tool) => tool.value === type)?.label ?? type;
  }
  protected stale(job: AiAuthorJob): boolean {
    if (this.unsaved() || job.sourceStale) return true;
    if (this.sourceVersion() === null) return false;
    return this.chapterId()
      ? job.sourceSnapshot.chapters.some(
          (chapter) => chapter.id === this.chapterId() && chapter.version !== this.sourceVersion(),
        )
      : job.sourceSnapshot.storyVersion !== this.sourceVersion();
  }
}
