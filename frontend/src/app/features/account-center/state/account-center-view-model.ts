import { inject } from '@angular/core';
import { AccountCenterFacade } from './account-center.facade';

/** Transitional presentation adapter. State and data live in AccountCenterFacade. */
export abstract class AccountCenterViewModel {
  protected readonly facade = inject(AccountCenterFacade);
  readonly sidebarOpen = this.facade.sidebarOpen;
  readonly activeLibraryTab = this.facade.activeLibraryTab;
  readonly activeHistoryTab = this.facade.activeHistoryTab;
  readonly notificationSettings = this.facade.notificationSettings;
  readonly page = this.facade.page;
  readonly title = this.facade.title;
  readonly primaryNavigation = this.facade.primaryNavigation;
  readonly accountNavigation = this.facade.accountNavigation;
  readonly stories = this.facade.stories;
  readonly reviews = this.facade.reviews;
  readonly comments = this.facade.comments;
  readonly transactions = this.facade.transactions;
  readonly toggleSidebar = this.facade.toggleSidebar.bind(this.facade);
  readonly closeSidebar = this.facade.closeSidebar.bind(this.facade);
  readonly toggleNotification = this.facade.toggleNotification.bind(this.facade);
  readonly notificationEnabled = this.facade.notificationEnabled.bind(this.facade);
}
