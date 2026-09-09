import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';

@Component({
  selector: 'app-chapter-paywall',
  imports: [DatePipe, RouterLink, ButtonComponent],
  templateUrl: './chapter-paywall.component.html',
  styleUrl: './chapter-paywall.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterPaywallComponent {
  readonly storyId = input.required<string>();
  readonly priceCredits = input<string | null>(null);
  readonly unlockPolicy = input<string>();
  readonly freeAt = input<string | null>();
  readonly pending = input(false);
  readonly message = input<string | null>(null);
  readonly unlockChapter = output<void>();
}
