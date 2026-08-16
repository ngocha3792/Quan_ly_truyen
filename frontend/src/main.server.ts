import { mergeApplicationConfig } from '@angular/core';
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { serverConfig } from './app/app.config.server';
import { loadServerAppRuntimeConfig } from './app/core/config/app-runtime-config.server';

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(
    App,
    mergeApplicationConfig(createAppConfig(loadServerAppRuntimeConfig()), serverConfig),
    context,
  );

export default bootstrap;
