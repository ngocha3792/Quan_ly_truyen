import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';
import { OfflineSourceChapter, OfflineSourceStory } from '../../domain/offline-package.models';

@Component({
  selector: 'app-create-offline-package-dialog',
  standalone: true,
  imports: [DialogShellComponent, IconComponent, SearchFieldComponent],
  templateUrl: './create-offline-package-dialog.component.html',
  styleUrls: [
    './create-offline-package-dialog.component.scss',
    './create-offline-package-dialog.form.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateOfflinePackageDialogComponent {
  readonly open = input(false);
  readonly busy = input(false);
  readonly stories = input.required<readonly OfflineSourceStory[]>();
  readonly storyQuery = input('');
  readonly selectedStoryId = input<string | null>(null);
  readonly chapters = input.required<readonly OfflineSourceChapter[]>();
  readonly selectedChapterIds = input<readonly string[]>([]);
  readonly chapterLoading = input(false);
  readonly chapterError = input<string | null>(null);
  readonly chapterPage = input(1);
  readonly chapterTotalPages = input(1);
  readonly maxChapters = input(50);
  readonly packageName = input('');
  readonly packageDescription = input('');
  readonly canSubmit = input(false);

  readonly closed = output<void>();
  readonly storyQueryChange = output<string>();
  readonly storySelected = output<string>();
  readonly chapterToggled = output<string>();
  readonly pageSelected = output<void>();
  readonly selectionCleared = output<void>();
  readonly previousPageRequested = output<void>();
  readonly nextPageRequested = output<void>();
  readonly packageNameChange = output<string>();
  readonly packageDescriptionChange = output<string>();
  readonly submitted = output<void>();

  protected isSelected(chapterId: string): boolean {
    return this.selectedChapterIds().includes(chapterId);
  }

  protected chapterToggleDisabled(chapterId: string): boolean {
    return !this.isSelected(chapterId) && this.selectedChapterIds().length >= this.maxChapters();
  }

  protected updateName(event: Event): void {
    this.packageNameChange.emit((event.target as HTMLInputElement).value);
  }

  protected updateDescription(event: Event): void {
    this.packageDescriptionChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
