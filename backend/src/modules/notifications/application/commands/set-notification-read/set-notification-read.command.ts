export class SetNotificationReadCommand {
  constructor(
    readonly userId: string,
    readonly notificationId: string,
    readonly isRead: boolean,
  ) {}
}
