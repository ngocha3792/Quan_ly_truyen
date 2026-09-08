import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

export const offlineReadingEnabledGuard: CanMatchFn = () => {
  const enabled = inject(APP_RUNTIME_CONFIG).features.offlineReadingEnabled;
  return enabled ? true : inject(Router).createUrlTree(['/tai-khoan']);
};
