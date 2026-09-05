import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-legal-section-item',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './legal-section-item.component.html',

  styleUrl: './legal-section-item.component.scss',
})
export class LegalSectionItemComponent {
  readonly number = input.required<number>();

  readonly title = input.required<string>();

  readonly description = input.required<string>();
}
