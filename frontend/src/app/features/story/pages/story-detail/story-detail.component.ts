import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { LibraryStore } from '../../../../core/storage/library.store';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { Story } from '../../../../shared/models/story.model';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';
import { HomeRepository } from '../../../home/data/home.repository';

@Component({
  selector: 'app-story-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, CompactNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-detail.component.html',
  styleUrl: './story-detail.component.scss',
})
export class StoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(HomeRepository);
  protected readonly library = inject(LibraryStore);
  protected readonly story = signal<Story | null | undefined>(undefined);
  protected readonly chapters = Array.from({ length: 12 }, (_, index) => index);

  constructor() {
    this.route.paramMap
      .pipe(switchMap((params) => this.repository.findStoryBySlug(params.get('slug') ?? '')))
      .subscribe((story) => this.story.set(story));
  }

  protected toggleLibrary(): void {
    const current = this.story();
    if (current) this.library.toggle(current.id);
  }
}
