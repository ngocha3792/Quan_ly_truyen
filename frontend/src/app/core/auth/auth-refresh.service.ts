import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { CurrentUser } from './auth.models';
import { TokenStore } from './token.store';

@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private readonly api = inject(AuthApiService);
  private readonly tokenStore = inject(TokenStore);

  refreshAccessToken(): Observable<string> {
    return this.api.refresh().pipe(
      map((response) => {
        this.tokenStore.set(response.accessToken);
        return response.accessToken;
      }),
      tap({
        error: () => {
          this.tokenStore.clear();
        },
      }),
    );
  }
}
