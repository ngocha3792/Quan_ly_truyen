export class UpdateCurrentUserProfileCommand {
    constructor(
        readonly userId: string | undefined,

        readonly displayName: string | undefined,

        readonly bio: string | null | undefined,

        readonly avatarMediaId: string | null | undefined,

        readonly ipAddress?: string,

        readonly userAgent?: string,

        readonly requestId?: string,
    ) { }
}