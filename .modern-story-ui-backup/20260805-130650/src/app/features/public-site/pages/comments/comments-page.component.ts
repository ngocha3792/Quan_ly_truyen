import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-comments-page',
  standalone: true,
  imports: [RouterLink, ButtonDirective, CardDirective],
  templateUrl: './comments-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicCommentsPageComponent extends PublicSiteViewModel {}
