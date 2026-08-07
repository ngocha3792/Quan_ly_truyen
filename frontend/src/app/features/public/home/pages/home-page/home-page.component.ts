import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { SectionHeadingComponent } from '../../../../../shared/components/section-heading/section-heading.component';
import { StoryCardComponent } from '../../../../../shared/components/story-card/story-card.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';
import { HomeStore } from '../../data-access/home.store';

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

  // Store chỉ tồn tại trong vòng đời của trang Home.
  providers: [HomeStore],

  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  protected readonly store = inject(HomeStore);

  ngOnInit(): void {
    this.store.loadData();
    this.store.startHeroAutoplay(7000);
  }
}