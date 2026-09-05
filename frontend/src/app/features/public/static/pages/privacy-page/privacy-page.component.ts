import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LegalPageHeaderComponent } from '../../../../../shared/components/legal-page-header/legal-page-header.component';
import { LegalPageShellComponent } from '../../../../../shared/components/legal-page-shell/legal-page-shell.component';
import { LegalSectionItemComponent } from '../../../../../shared/components/legal-section-item/legal-section-item.component';
import { LegalSupportCtaComponent } from '../../../../../shared/components/legal-support-cta/legal-support-cta.component';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [
    LegalPageShellComponent,
    LegalPageHeaderComponent,
    LegalSectionItemComponent,
    LegalSupportCtaComponent,
  ],
  templateUrl: './privacy-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {}
