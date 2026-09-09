import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getApiErrorMessage } from '../../../../../../core/http/api-error.util';
import { ChapterEditingSessionStore } from '../../../data-access/chapter-editing-session.store';
import { AuthorManagedChapter } from '../../../domain/author-story-management.models';
import { AiStoryProfileStore } from '../../data-access/ai-story-profile.store';
import { provideChapterTranslation } from '../../data-access/chapter-translation.providers';
import { ChapterTranslationStore } from '../../data-access/chapter-translation.store';
import {
  TARGET_LANGUAGE_OPTIONS,
  TranslationReviewInput,
} from '../../domain/chapter-translation.models';
import { ChapterTranslationRepository } from '../../domain/chapter-translation.repository';
import { ChapterTranslationPanelComponent } from '../../ui/chapter-translation-panel/chapter-translation-panel.component';

@Component({
  selector: 'app-chapter-translation-workspace',
  standalone: true,
  imports: [ChapterTranslationPanelComponent],
  providers: [provideChapterTranslation(), ChapterTranslationStore, AiStoryProfileStore],
  templateUrl: './chapter-translation-workspace.component.html',
  styleUrl: './chapter-translation-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterTranslationWorkspaceComponent {
  readonly storyId = input.required<string>();
  readonly chapterId = input.required<string>();
  readonly canEdit = input(false);
  readonly imported = output<AuthorManagedChapter>();
  protected readonly session = inject(ChapterEditingSessionStore);
  protected readonly store = inject(ChapterTranslationStore);
  protected readonly profile = inject(AiStoryProfileStore);
  protected readonly languages = TARGET_LANGUAGE_OPTIONS;
  protected readonly reviewing = signal(false);
  protected readonly blocked = computed(
    () =>
      !this.canEdit() ||
      this.session.dirty() ||
      this.session.busy() ||
      this.session.status() === 'conflict' ||
      this.session.recoveries().length > 0,
  );
  protected readonly requestBlocked = computed(
    () =>
      this.session.dirty() ||
      this.session.busy() ||
      this.session.status() === 'conflict' ||
      this.session.recoveries().length > 0,
  );
  private readonly repository = inject(ChapterTranslationRepository);
  constructor() {
    effect(() => {
      const storyId = this.storyId();
      untracked(() => this.profile.load(storyId));
    });
    effect(() => {
      const storyId = this.storyId();
      const chapterId = this.chapterId();
      const language = this.profile.profile()?.defaultTranslationLanguageCode ?? 'en';
      untracked(() => this.store.refresh(storyId, chapterId, language));
    });
  }
  protected async review(input: TranslationReviewInput): Promise<void> {
    const result = this.store.translation();
    const chapter = this.session.chapter();
    if (!result || !chapter || this.reviewing() || (input.decision === 'APPROVE' && this.blocked()))
      return;
    this.reviewing.set(true);
    this.store.error.set(null);
    const revision = this.session.revision();
    if (input.decision === 'APPROVE') {
      this.session.busy.set(true);
      this.session.restoring.set(true);
    }
    try {
      const response = await firstValueFrom(
        this.repository.review(this.storyId(), this.chapterId(), result.targetLanguageCode, {
          ...input,
          expectedVersion: chapter.version,
          translationId: result.id,
          generation: result.generation,
        }),
      );
      this.store.translation.set(response.translation);
      if (response.chapter) {
        await this.session.adoptApprovedTranslation(response.chapter, revision);
        this.imported.emit(response.chapter);
      }
    } catch (error) {
      this.store.error.set(getApiErrorMessage(error));
      if (input.decision === 'APPROVE') await this.session.handleError(error);
    } finally {
      this.reviewing.set(false);
      if (input.decision === 'APPROVE') {
        this.session.busy.set(false);
        this.session.restoring.set(false);
      }
    }
  }
}
