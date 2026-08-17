export interface UserModerationPort {
  banUser(input: {
    readonly actorUserId: string;
    readonly targetUserId: string;
    readonly reason: string;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  }): Promise<void>;
}

export const USER_MODERATION_PORT = Symbol('USER_MODERATION_PORT');
