import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ChapterReaderStore } from '../../data-access/chapter-reader.store';
import { ChapterCommentsComponent } from '../../ui/chapter-comments/chapter-comments.component';
import { ChapterHeadingComponent } from '../../ui/chapter-heading/chapter-heading.component';
import { ChapterSidebarComponent } from '../../ui/chapter-sidebar/chapter-sidebar.component';

@Component({
  selector: 'app-chapter-reader-page',
  standalone: true,

  imports: [RouterLink, ChapterHeadingComponent, ChapterSidebarComponent, ChapterCommentsComponent],


  templateUrl: './chapter-reader-page.component.html',
  styleUrls: ['./chapter-reader-page.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterReaderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(ChapterReaderStore);

  ngOnInit(): void {
    const subscription = this.route.paramMap.subscribe((params) => {
      const storySlug = params.get('storySlug') ?? '';
      const chapterNumber = params.get('chapterNumber') ?? '';

      if (storySlug && chapterNumber) {
        this.store.load(storySlug, chapterNumber);
      }
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
