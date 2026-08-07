export class UpdateCurrentUserPreferencesCommand {
    constructor(
        readonly userId: string | undefined,

        readonly newChapterNotifications:
            boolean | undefined,

        readonly showRecentActivity:
            boolean | undefined,

        readonly allowUpdateEmails:
            boolean | undefined,

        readonly ipAddress?: string,

        readonly userAgent?: string,

        readonly requestId?: string,
    ) { }
}