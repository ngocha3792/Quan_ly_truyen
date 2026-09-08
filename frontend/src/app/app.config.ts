import { provideHttpClient, withInterceptors } from '@angular/common/http';

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';

import { AppRuntimeConfig, APP_RUNTIME_CONFIG } from './core/config/app-config.token';

import { apiInterceptor } from './core/http/api.interceptor';
import { PwaBootstrapService } from './core/pwa/pwa-bootstrap.service';

export function createAppConfig(runtimeConfig: AppRuntimeConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),

      {
        provide: APP_RUNTIME_CONFIG,
        useValue: runtimeConfig,
      },

      provideHttpClient(withInterceptors([apiInterceptor])),

      provideClientHydration(withEventReplay()),

      provideAppInitializer(() => inject(PwaBootstrapService).initialize()),

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
