import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryStore } from '../../../core/storage/library.store';
import { Story } from '../../models/story.model';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-story-card',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-card.component.html',
  styleUrl: './story-card.component.scss',
})
export class StoryCardComponent {
  readonly story = input.required<Story>();
  protected readonly library = inject(LibraryStore);

  protected toggleLibrary(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.library.toggle(this.story().id);
  }
}
