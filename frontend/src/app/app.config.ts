import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';

import { AppRuntimeConfig, APP_RUNTIME_CONFIG } from './core/config/app-config.token';

import { apiInterceptor } from './core/http/api.interceptor';

export function createAppConfig(runtimeConfig: AppRuntimeConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),

      {
        provide: APP_RUNTIME_CONFIG,
        useValue: runtimeConfig,
      },

      provideHttpClient(withInterceptors([apiInterceptor])),

      provideRouter(
        routes,

        withComponentInputBinding(),

        withInMemoryScrolling({
          scrollPositionRestoration: 'top',
        }),

        withViewTransitions(),
      ),
    ],
  };
}
