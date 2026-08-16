import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetNotificationViewCommand,
  GetNotificationViewCommandHandler,
  MarkAllNotificationsReadCommand,
  MarkAllNotificationsReadCommandHandler,
  SetNotificationReadCommand,
  SetNotificationReadCommandHandler,
  SetNotificationSavedCommand,
  SetNotificationSavedCommandHandler,
  UpdateNotificationSettingsCommand,
  UpdateNotificationSettingsCommandHandler,
} from '../../../application';

import type {
  NotificationSettingsDto,
  NotificationViewDto,
} from '../../../application';

import {
  SetNotificationFlagRequest,
  UpdateNotificationSettingsRequest,
} from '../requests';

@Controller('notifications')
@RequirePermissions(PermissionCode.NOTIFICATION_MANAGE_OWN)
export class NotificationsController {
  constructor(
    private readonly getViewHandler: GetNotificationViewCommandHandler,
    private readonly setReadHandler: SetNotificationReadCommandHandler,
    private readonly setSavedHandler: SetNotificationSavedCommandHandler,
    private readonly markAllReadHandler: MarkAllNotificationsReadCommandHandler,
    private readonly updateSettingsHandler: UpdateNotificationSettingsCommandHandler,
  ) {}

  @Get()
  getView(
    @CurrentUserId() userId: string | undefined,
  ): Promise<NotificationViewDto> {
    return this.getViewHandler.execute(
      new GetNotificationViewCommand(this.requireUserId(userId)),
    );
  }

  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setRead(
    @CurrentUserId() userId: string | undefined,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' }))
    notificationId: string,
    @Body() request: SetNotificationFlagRequest,
  ): Promise<void> {
    await this.setReadHandler.execute(
      new SetNotificationReadCommand(
        this.requireUserId(userId),
        notificationId,
        request.value,
      ),
    );
  }

  @Patch(':notificationId/saved')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setSaved(
    @CurrentUserId() userId: string | undefined,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' }))
    notificationId: string,
    @Body() request: SetNotificationFlagRequest,
  ): Promise<void> {
    await this.setSavedHandler.execute(
      new SetNotificationSavedCommand(
        this.requireUserId(userId),
        notificationId,
        request.value,
      ),
    );
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(
    @CurrentUserId() userId: string | undefined,
  ): Promise<void> {
    await this.markAllReadHandler.execute(
      new MarkAllNotificationsReadCommand(this.requireUserId(userId)),
    );
  }

  @Patch('settings')
  updateSettings(
    @CurrentUserId() userId: string | undefined,
    @Body() request: UpdateNotificationSettingsRequest,
  ): Promise<NotificationSettingsDto> {
    return this.updateSettingsHandler.execute(
      new UpdateNotificationSettingsCommand(
        this.requireUserId(userId),
        request.newChapters,
        request.comments,
        request.system,
        request.promotions,
      ),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return userId;
  }
}
