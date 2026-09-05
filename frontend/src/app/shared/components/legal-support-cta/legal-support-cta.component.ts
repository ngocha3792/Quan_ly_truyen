import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal-support-cta',

  standalone: true,

  imports: [RouterLink],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './legal-support-cta.component.html',

  styleUrl: './legal-support-cta.component.scss',
})
export class LegalSupportCtaComponent {
  readonly title = input.required<string>();

  readonly description = input.required<string>();
}
