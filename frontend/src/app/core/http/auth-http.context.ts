import { HttpContextToken } from '@angular/common/http';

export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);
