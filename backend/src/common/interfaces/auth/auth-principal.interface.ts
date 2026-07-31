import { PermissionCode, RoleCode } from "@/common/enums"

export interface AuthPrincipal {
    userId: string;
    sessionId: string;

    roles: readonly RoleCode[];
    permissions: readonly PermissionCode[];

    /**
     * Có khi user sở hữu AuthorProfile.
     */
    authorProfileId?: string;
}