import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LegalPageHeaderComponent } from '../../../../../shared/components/legal-page-header/legal-page-header.component';

@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [RouterLink, LegalPageHeaderComponent],
  templateUrl: './support-page.component.html',
  styleUrls: ['./support-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportPageComponent {}
