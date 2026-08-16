import type { AdminSecurityEventView, AdminSessionView } from '../../../application/services';
export interface AdminSessionResponse { sessionId:string;createdAt:string;lastSeenAt:string|null;expiresAt:string;deviceName:string|null;userAgent:string|null;ipAddress:string|null;revoked:boolean;revokedAt:string|null;revokedReason:string|null }
export interface AdminSecurityEventResponse { id:string;action:string;ipAddress:string|null;userAgent:string|null;requestId:string|null;createdAt:string }
export const toAdminSessionResponse=(s:AdminSessionView):AdminSessionResponse=>({...s,createdAt:s.createdAt.toISOString(),lastSeenAt:s.lastSeenAt?.toISOString()??null,expiresAt:s.expiresAt.toISOString(),revokedAt:s.revokedAt?.toISOString()??null});
export const toAdminSecurityEventResponse=(e:AdminSecurityEventView):AdminSecurityEventResponse=>({...e,createdAt:e.createdAt.toISOString()});
