import { Observable } from 'rxjs';

import {
  CreateOfflinePackageInput,
  OfflinePackageSummary,
  OfflineQuota,
  OfflineSourceChapterPage,
  OfflineSourceStory,
} from './offline-package.models';

export abstract class OfflinePackagesRepository {
  abstract listPackages(): Observable<readonly OfflinePackageSummary[]>;
  abstract getQuota(): Observable<OfflineQuota>;
  abstract createPackage(input: CreateOfflinePackageInput): Observable<OfflinePackageSummary>;
  abstract deletePackage(packageId: string): Observable<void>;
  abstract touchPackage(packageId: string): Observable<void>;
  abstract listSourceStories(): Observable<readonly OfflineSourceStory[]>;
  abstract listStoryChapters(
    storySlug: string,
    page: number,
    pageSize: number,
  ): Observable<OfflineSourceChapterPage>;
}
