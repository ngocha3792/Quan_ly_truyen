import { inject } from '@angular/core';
import { AuthorSuiteFacade } from './author-suite.facade';

/** Transitional presentation adapter. State and data live in AuthorSuiteFacade. */
export abstract class AuthorSuiteViewModel {
  protected readonly facade = inject(AuthorSuiteFacade);
  readonly sidebarOpen = this.facade.sidebarOpen;
  readonly activeTab = this.facade.activeTab;
  readonly settingsTab = this.facade.settingsTab;
  readonly page = this.facade.page;
  readonly title = this.facade.title;
  readonly nav = this.facade.nav;
  readonly stories = this.facade.stories;
  readonly chapters = this.facade.chapters;
  readonly messages = this.facade.messages;
  readonly notices = this.facade.notices;
  readonly transactions = this.facade.transactions;
  readonly chartPoints = this.facade.chartPoints;
  readonly toggleSidebar = this.facade.toggleSidebar.bind(this.facade);
  readonly closeSidebar = this.facade.closeSidebar.bind(this.facade);
}
