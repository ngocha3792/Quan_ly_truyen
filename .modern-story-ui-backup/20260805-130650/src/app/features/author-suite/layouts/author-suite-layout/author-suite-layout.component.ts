import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { WorkspaceLayoutComponent } from '../../../../layouts/workspace-layout/workspace-layout.component';
import { AuthorSuiteFacade } from '../../state/author-suite.facade';
import { AUTHOR_NAVIGATION } from '../../config/author-navigation.config';

@Component({
  selector: 'app-author-suite-layout',
  standalone: true,
  imports: [WorkspaceLayoutComponent],
  providers: [AuthorSuiteFacade],
  templateUrl: './author-suite-layout.component.html',
  styleUrls: ['../../styles/author-suite.pages.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteLayoutComponent {
  readonly navigation = AUTHOR_NAVIGATION;
}
