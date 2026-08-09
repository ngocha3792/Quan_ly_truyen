import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-section-heading',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-heading.component.html',
  styleUrl: './section-heading.component.scss',
})
export class SectionHeadingComponent {
  readonly title = input.required<string>();
  readonly link = input<string | null>(null);
}
