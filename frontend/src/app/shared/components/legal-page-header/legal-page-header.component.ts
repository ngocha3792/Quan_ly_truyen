import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-legal-page-header',

  standalone: true,

  imports: [DatePipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './legal-page-header.component.html',

  styleUrl: './legal-page-header.component.scss',
})
export class LegalPageHeaderComponent {
  readonly badge = input.required<string>();

  readonly title = input.required<string>();

  readonly description = input.required<string>();

  readonly updatedAt = input<string | null>(null);
}
