import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
    CanActivateFn,
    Router,
} from '@angular/router';

import {
    filter,
    map,
    take,
} from 'rxjs';

import { AuthStore } from './auth.store';

export const authenticatedGuard: CanActivateFn = () => {
    const auth = inject(AuthStore);
    const router = inject(Router);

    if (auth.status() === 'authenticated') {
        return true;
    }

    auth.initialize();

    return toObservable(auth.status).pipe(
        filter(
            (status) =>
                status !== 'idle' &&
                status !== 'loading',
        ),
        take(1),
        map((status) => {
            if (status === 'authenticated') {
                return true;
            }

            return router.createUrlTree(['/'], {
                queryParams: {
                    loginRequired: true,
                },
            });
        }),
    );
};