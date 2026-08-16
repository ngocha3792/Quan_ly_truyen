import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { publicAppOrigin, serverApiOrigin } from './core/config/app-runtime-config.server';
import { SEO_PUBLIC_ORIGIN } from './core/seo/seo.service';
import { serverRoutes } from './app.routes.server';

export const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useFactory: () => ({
        [serverApiOrigin()]: publicAppOrigin(),
      }),
    },
    {
      provide: SEO_PUBLIC_ORIGIN,
      useFactory: publicAppOrigin,
    },
  ],
};
