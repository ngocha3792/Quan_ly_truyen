import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { NoticeComponent } from '../../../../../../shared/components/notice/notice.component';
import {
  AiStoryProfile,
  ChapterTranslation,
  TargetLanguageOption,
  UpdateAiStoryProfilePayload,
} from '../../domain/chapter-translation.models';

const STATUS_LABELS: Record<ChapterTranslation['status'], string> = {
  PENDING: 'Đang chờ xử lý',
  PROCESSING: 'Đang dịch...',
  COMPLETED: 'Đã hoàn tất',
  FAILED: 'Dịch thất bại',
};

@Component({
  selector: 'app-chapter-translation-panel',
  standalone: true,
  imports: [FormsModule, ButtonComponent, NoticeComponent],
  templateUrl: './chapter-translation-panel.component.html',
  styleUrl: './chapter-translation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterTranslationPanelComponent {
  readonly languages = input.required<readonly TargetLanguageOption[]>();
  readonly requesting = input(false);
  readonly translation = input<ChapterTranslation | null>(null);
  readonly error = input<string | null>(null);
  readonly profile = input<AiStoryProfile | null>(null);
  readonly profileSaving = input(false);

  readonly translateRequested = output<string>();
  readonly refreshRequested = output<string>();
  readonly errorDismissed = output<void>();
  readonly profileUpdated = output<UpdateAiStoryProfilePayload>();

  protected readonly selectedLanguageCode = signal('');
  protected profileModel = '';
  protected profileSystemPrompt = '';
  protected profileLanguage = '';
  protected profileAutoTranslate: boolean | null = null;

  protected readonly statusLabels = STATUS_LABELS;

  constructor() {
    effect(() => {
      const options = this.languages();
      if (!this.selectedLanguageCode() && options.length > 0) {
        this.selectedLanguageCode.set(options[0].code);
      }
    });
    effect(() => {
      const profile = this.profile();
      if (!profile) return;
      this.profileModel = profile.model ?? '';
      this.profileSystemPrompt = profile.systemPrompt ?? '';
      this.profileLanguage = profile.inherits.includes('defaultTranslationLanguageCode')
        ? ''
        : profile.defaultTranslationLanguageCode;
      this.profileAutoTranslate = profile.inherits.includes('autoTranslateOnPublish')
        ? null
        : profile.autoTranslateOnPublish;
      this.selectedLanguageCode.set(profile.defaultTranslationLanguageCode);
    });
  }

  protected translateChapter(): void {
    this.translateRequested.emit(this.selectedLanguageCode());
  }

  protected refreshStatus(): void {
    this.refreshRequested.emit(this.selectedLanguageCode());
  }

  protected saveProfile(): void {
    this.profileUpdated.emit({
      model: this.profileModel.trim() || null,
      systemPrompt: this.profileSystemPrompt.trim() || null,
      defaultTranslationLanguageCode: this.profileLanguage || null,
      autoTranslateOnPublish: this.profileAutoTranslate,
    });
  }
}
