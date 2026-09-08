import { Provider } from '@angular/core';

import { OfflinePackagesRepository } from '../domain/offline-packages.repository';
import { OfflinePackageCreateStore } from './offline-package-create.store';
import { OfflinePackagesHttpRepository } from './offline-packages-http.repository';
import { OfflinePackagesStore } from './offline-packages.store';

export function provideOfflinePackages(): Provider[] {
  return [
    {
      provide: OfflinePackagesRepository,
      useClass: OfflinePackagesHttpRepository,
    },
    OfflinePackagesStore,
    OfflinePackageCreateStore,
  ];
}
