import { mergeApplicationConfig } from '@angular/core';
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { IS_DISCOVERING_ROUTES } from '@angular/ssr';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { serverConfig } from './app/app.config.server';
import {
  createRouteDiscoveryRuntimeConfig,
  loadServerAppRuntimeConfig,
} from './app/core/config/app-runtime-config.server';

const bootstrap = async (context: BootstrapContext) => {
  const isDiscoveringRoutes = context.platformRef.injector.get(IS_DISCOVERING_ROUTES);
  const runtimeConfig = isDiscoveringRoutes
    ? createRouteDiscoveryRuntimeConfig()
    : await loadServerAppRuntimeConfig();

  return bootstrapApplication(
    App,
    mergeApplicationConfig(createAppConfig(runtimeConfig), serverConfig),
    context,
  );
};

export default bootstrap;
