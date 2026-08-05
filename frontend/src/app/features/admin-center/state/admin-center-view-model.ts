import { inject } from '@angular/core';
import { AdminCenterFacade } from './admin-center.facade';

/** Transitional presentation adapter. State and data live in AdminCenterFacade. */
export abstract class AdminCenterViewModel {
  protected readonly facade = inject(AdminCenterFacade);
  readonly sidebarOpen = this.facade.sidebarOpen;
  readonly activeTab = this.facade.activeTab;
  readonly settingsTab = this.facade.settingsTab;
  readonly page = this.facade.page;
  readonly title = this.facade.title;
  readonly nav = this.facade.nav;
  readonly stories = this.facade.stories;
  readonly chapters = this.facade.chapters;
  readonly users = this.facade.users;
  readonly authors = this.facade.authors;
  readonly comments = this.facade.comments;
  readonly reports = this.facade.reports;
  readonly categories = this.facade.categories;
  readonly transactions = this.facade.transactions;
  readonly ads = this.facade.ads;
  readonly activities = this.facade.activities;
  readonly chartPoints = this.facade.chartPoints;
  readonly chartArea = this.facade.chartArea;
  readonly toggleSidebar = this.facade.toggleSidebar.bind(this.facade);
  readonly closeSidebar = this.facade.closeSidebar.bind(this.facade);
}
