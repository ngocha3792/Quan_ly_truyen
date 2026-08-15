import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  type NotificationSettingsResponse,
  NotificationsService,
  type NotificationsViewResponse,
} from './notifications.service';

class SetNotificationFlagRequest {
  @IsBoolean()
  readonly value!: boolean;
}

class UpdateNotificationSettingsRequest {
  @IsOptional()
  @IsBoolean()
  readonly newChapters?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly comments?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly system?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly promotions?: boolean;
}

@Controller('notifications')
@RequirePermissions(PermissionCode.NOTIFICATION_MANAGE_OWN)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  getView(
    @CurrentUserId() userId: string | undefined,
  ): Promise<NotificationsViewResponse> {
    return this.notifications.getView(userId);
  }

  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setRead(
    @CurrentUserId() userId: string | undefined,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' })) notificationId: string,
    @Body() request: SetNotificationFlagRequest,
  ): Promise<void> {
    await this.notifications.setRead(userId, notificationId, request.value);
  }

  @Patch(':notificationId/saved')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setSaved(
    @CurrentUserId() userId: string | undefined,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' })) notificationId: string,
    @Body() request: SetNotificationFlagRequest,
  ): Promise<void> {
    await this.notifications.setSaved(userId, notificationId, request.value);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@CurrentUserId() userId: string | undefined): Promise<void> {
    await this.notifications.markAllAsRead(userId);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUserId() userId: string | undefined,
    @Body() request: UpdateNotificationSettingsRequest,
  ): Promise<NotificationSettingsResponse> {
    return this.notifications.updateSettings(userId, request);
  }
}
