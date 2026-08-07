import type {
  HeroSlide,
  HomePageData,
  QuickAction,
  Story,
} from '../../../../shared/models/story.model';

export type {
  HeroSlide,
  HomePageData,
  QuickAction,
  Story,
};

export interface HomeState {
  readonly data: HomePageData | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly activeHeroIndex: number;
}
