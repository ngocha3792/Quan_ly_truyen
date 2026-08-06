import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LibraryStore } from '../../../../core/storage/library.store';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';
import { StoryDetailStore } from '../../data-access/story.store';
import { StoryCommentsComponent } from '../../ui/story-comments/story-comments.component';
import { StoryRelatedComponent } from '../../ui/story-related/story-related.component';

@Component({
  selector: 'app-story-detail',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    CompactNumberPipe,
    StoryCommentsComponent,
    StoryRelatedComponent,
  ],
  providers: [StoryDetailStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './story-detail.component.html',
  styleUrl: './story-detail.component.scss',
})
export class StoryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(StoryDetailStore);
  protected readonly library = inject(LibraryStore);
  protected readonly chapters = Array.from({ length: 12 }, (_, index) => index);

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      if (slug) {
        this.store.loadStory(slug);
      }
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  protected toggleLibrary(): void {
    const current = this.store.story();
    if (current) this.library.toggle(current.id);
  }
}
