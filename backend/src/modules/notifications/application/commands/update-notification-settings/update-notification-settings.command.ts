export class UpdateNotificationSettingsCommand {
  constructor(
    readonly userId: string,
    readonly newChapters?: boolean,
    readonly comments?: boolean,
    readonly system?: boolean,
    readonly promotions?: boolean,
  ) {}
}
