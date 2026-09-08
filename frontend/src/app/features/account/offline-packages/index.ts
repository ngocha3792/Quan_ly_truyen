export { offlineReadingEnabledGuard } from './data-access/offline-reading-enabled.guard';
export { provideOfflinePackages } from './data-access/offline-packages.providers';

export const loadOfflinePackagesPage = () =>
  import('./pages/offline-packages-page/offline-packages-page.component').then(
    (module) => module.OfflinePackagesPageComponent,
  );
