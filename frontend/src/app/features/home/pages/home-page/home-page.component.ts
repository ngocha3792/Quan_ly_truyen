import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomePageData } from '../../../../shared/models/story.model';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SectionHeadingComponent } from '../../../../shared/components/section-heading/section-heading.component';
import { StoryCardComponent } from '../../../../shared/components/story-card/story-card.component';
import { HomeRepository } from '../../data/home.repository';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    RouterLink,
    CompactNumberPipe,
    RelativeTimePipe,
    IconComponent,
    SectionHeadingComponent,
    StoryCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  private readonly repository = inject(HomeRepository);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = signal<HomePageData | null>(null);
  protected readonly loading = signal(true);
  protected readonly activeHeroIndex = signal(0);
  protected readonly activeHero = computed(() => {
    const slides = this.data()?.heroSlides ?? [];
    return slides[this.activeHeroIndex()] ?? null;
  });

  ngOnInit(): void {
    this.repository.loadHome().subscribe((data) => {
      this.data.set(data);
      this.loading.set(false);
    });

    const timer = window.setInterval(() => this.nextHero(), 7000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  protected nextHero(): void {
    const length = this.data()?.heroSlides.length ?? 0;
    if (length > 0) this.activeHeroIndex.update((index) => (index + 1) % length);
  }

  protected previousHero(): void {
    const length = this.data()?.heroSlides.length ?? 0;
    if (length > 0) this.activeHeroIndex.update((index) => (index - 1 + length) % length);
  }
}
