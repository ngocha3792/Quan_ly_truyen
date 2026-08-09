import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
})
export class BrandLogoComponent {
  readonly compact = input(false);
}
