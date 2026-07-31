import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonFiltersModule } from './common/filters';
import { CommonInterceptorsModule } from './common/interceptors';
import {
  CommonMiddlewaresModule,
  JsonContentTypeMiddleware,
  LocaleMiddleware,
  MaintenanceModeMiddleware,
  RequestContextMiddleware,
} from './common/middlewares';

@Module({
  imports: [
    CommonMiddlewaresModule.register({
      requestContext: {
        trustIncomingRequestId: true,
        trustIncomingCorrelationId: true,
      },
      locale: {
        defaultLocale: 'vi-VN',
        supportedLocales: ['vi-VN', 'en-US'],
      },
      maintenance: {
        resolveState: () => ({
          enabled: process.env.MAINTENANCE_MODE === 'true',
          message: 'Hệ thống đang bảo trì',
          retryAfterSeconds: 300,
        }),
        allowedPaths: ['/api/v1/health'],
        bypassHeaderName: 'x-maintenance-key',
        bypassToken: process.env.MAINTENANCE_BYPASS_TOKEN,
      },
    }),
    CommonInterceptorsModule,
    CommonFiltersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestContextMiddleware,
        LocaleMiddleware,
        MaintenanceModeMiddleware,
      )
      .forRoutes({
        path: '{*path}',
        method: RequestMethod.ALL,
      });

    consumer
      .apply(JsonContentTypeMiddleware)
      .exclude(
        { path: 'api/v1/media/upload', method: RequestMethod.POST },
        { path: 'api/v1/webhooks/{*path}', method: RequestMethod.ALL },
      )
      .forRoutes({
        path: 'api/v1/{*path}',
        method: RequestMethod.ALL,
      });
  }
}
