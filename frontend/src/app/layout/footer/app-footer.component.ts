import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
})
export class AppFooterComponent {}
