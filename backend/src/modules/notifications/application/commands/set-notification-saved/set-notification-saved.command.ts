export class SetNotificationSavedCommand {
  constructor(
    readonly userId: string,
    readonly notificationId: string,
    readonly isSaved: boolean,
  ) {}
}
