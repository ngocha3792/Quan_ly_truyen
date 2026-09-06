import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { NoticeComponent } from '../../../../../../shared/components/notice/notice.component';
import { ChapterTranslation, TargetLanguageOption } from '../../domain/chapter-translation.models';

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

  readonly translateRequested = output<string>();
  readonly refreshRequested = output<string>();
  readonly errorDismissed = output<void>();

  protected readonly selectedLanguageCode = signal('');

  protected readonly statusLabels = STATUS_LABELS;

  constructor() {
    effect(() => {
      const options = this.languages();
      if (!this.selectedLanguageCode() && options.length > 0) {
        this.selectedLanguageCode.set(options[0].code);
      }
    });
  }

  protected translateChapter(): void {
    this.translateRequested.emit(this.selectedLanguageCode());
  }

  protected refreshStatus(): void {
    this.refreshRequested.emit(this.selectedLanguageCode());
  }
}
