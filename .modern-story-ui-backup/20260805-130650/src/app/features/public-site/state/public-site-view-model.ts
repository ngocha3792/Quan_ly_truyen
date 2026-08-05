import { inject } from '@angular/core';
import { PublicSiteFacade } from './public-site.facade';

/** Transitional presentation adapter. State and data live in PublicSiteFacade. */
export abstract class PublicSiteViewModel {
  protected readonly facade = inject(PublicSiteFacade);
  readonly mobileNavOpen = this.facade.mobileNavOpen;
  readonly chapterPanelOpen = this.facade.chapterPanelOpen;
  readonly readerSettingsOpen = this.facade.readerSettingsOpen;
  readonly activeRanking = this.facade.activeRanking;
  readonly activeGuide = this.facade.activeGuide;
  readonly fontSize = this.facade.fontSize;
  readonly bookmarked = this.facade.bookmarked;
  readonly page = this.facade.page;
  readonly stories = this.facade.stories;
  readonly genres = this.facade.genres;
  readonly chapters = this.facade.chapters;
  readonly comments = this.facade.comments;
  readonly increaseFont = this.facade.increaseFont.bind(this.facade);
  readonly decreaseFont = this.facade.decreaseFont.bind(this.facade);
  readonly goBack = this.facade.goBack.bind(this.facade);
}
