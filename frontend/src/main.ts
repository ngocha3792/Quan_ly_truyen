import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';

import { createAppConfig } from './app/app.config';

import { loadAppRuntimeConfig } from './app/core/config/app-runtime-config.loader';

async function bootstrap(): Promise<void> {
  const runtimeConfig = await loadAppRuntimeConfig();

  await bootstrapApplication(App, createAppConfig(runtimeConfig));
}

void bootstrap().catch((error: unknown) => {
  console.error('Không thể khởi động TruyenHub frontend:', error);
});
