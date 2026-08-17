import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonFiltersModule } from './common/filters';
import { CommonGuardsModule } from './common/guards';
import { CommonInterceptorsModule } from './common/interceptors';
import {
  CommonMiddlewaresModule,
  JsonContentTypeMiddleware,
  LocaleMiddleware,
  MaintenanceModeMiddleware,
  RequestContextMiddleware,
} from './common/middlewares';
import { AppConfigModule } from './config';
import type { AppConfig, MaintenanceConfig } from './config';
import { HealthModule } from '@/infrastructure/health';
import { InfrastructureModule } from './infrastructure';
import { AuthModule } from './modules/auth';
import { ObservabilityModule } from './infrastructure/observability';
import { AuthorApplicationsModule } from './modules/author-applications';
import { AuthorsModule } from './modules/authors';
import { NotificationsModule } from './modules/notifications';
import { StoriesModule } from './modules/stories';
import { RatingsModule } from './modules/ratings';
import { LibrariesModule } from './modules/libraries';
import { ReadingHistoryModule } from './modules/reading-history';
import { CommentsModule } from './modules/comments';
import { ChaptersModule } from './modules/chapters';
import { CategoriesModule } from './modules/categories';
import { TagsModule } from './modules/tags';
import { FollowsModule } from './modules/follows';
import { ReportsModule } from './modules/reports';
import { MediaModule } from './modules/media';
import { ModerationModule } from './modules/moderation';
import { AuditLogsModule } from './modules/audit-logs';
import { AnalyticsModule } from './modules/analytics';
@Module({
  imports: [
    AppConfigModule,
    ObservabilityModule,
    AuthModule,
    AuthorApplicationsModule,
    AuthorsModule,
    NotificationsModule,
    StoriesModule,
    RatingsModule,
    LibrariesModule,
    ReadingHistoryModule,
    CommentsModule,
    ChaptersModule,
    CategoriesModule,
    TagsModule,
    FollowsModule,
    ReportsModule,
    MediaModule,
    ModerationModule,
    AuditLogsModule,
    AnalyticsModule,
    CommonGuardsModule,
    InfrastructureModule,
    HealthModule,
    UsersModule,
    CommonMiddlewaresModule.registerAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const app = configService.getOrThrow<AppConfig>('app');
        const maintenance =
          configService.getOrThrow<MaintenanceConfig>('maintenance');

        return {
          requestContext: {
            trustIncomingRequestId: true,
            trustIncomingCorrelationId: true,
          },
          locale: {
            defaultLocale: app.defaultLocale,
            supportedLocales: app.supportedLocales,
          },
          maintenance: {
            resolveState: () => ({
              enabled: maintenance.enabled,
              message: maintenance.message,
              retryAfterSeconds: maintenance.retryAfterSeconds,
            }),
            allowedPaths: maintenance.allowedPaths,
            bypassHeaderName: maintenance.bypassHeaderName,
            bypassToken: maintenance.bypassToken,
          },
        };
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
